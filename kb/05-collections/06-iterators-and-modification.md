---
title: "Итераторы и модификация коллекций"
section: 5
section_title: "Коллекции (Java Collections Framework)"
topic_slug: "05-06-iterators-and-modification"
roadmap_ref: "Раздел 5 → Итераторы и модификация коллекций"
status: not-started
tags: [collections, iterator, fail-fast, concurrent-modification, removeif]
related:
  - "05-01-collections-hierarchy"
  - "05-02-list-implementations"
  - "05-04-hashmap-internals"
  - "08-07-concurrent-collections-and-atomics"
  - "07-03-stream-api"
last_reviewed: null
---

`ConcurrentModificationException` в однопоточном коде — одна из самых частых
ошибок с коллекциями, и вопрос «как удалить элемент во время обхода» звучит на
собеседованиях постоянно. Senior должен объяснить механизм `modCount`, почему
исключение — лишь «лучшая попытка», а не гарантия, и чем отличаются итераторы
обычных и конкурентных коллекций.

## Ключевые концепции

### Fail-fast vs fail-safe

#### Fail-fast: modCount и ConcurrentModificationException
Итераторы обычных коллекций — `ArrayList`, `HashMap`, `HashSet` и других —
fail-fast. Коллекция ведёт счётчик структурных изменений `modCount`:
добавление и удаление его увеличивают, а замена элемента через `set` — нет.
Итератор при создании запоминает значение в `expectedModCount` и сверяет его
при каждом `next()`.

Если коллекцию изменили в обход итератора, счётчики разойдутся, и следующий
`next()` бросит `ConcurrentModificationException`. Название вводит в
заблуждение: «concurrent» здесь означает не потоки, а одновременные обход и
изменение. Чаще всего исключение возникает в однопоточном коде — при удалении
в for-each.

```java
List<String> names = new ArrayList<>(List.of("Anna", "Bob", "Carl", "Dina"));
for (String n : names) {
    if (n.startsWith("B")) names.remove(n);   // перехвачено
}
```
```
удаляем Bob: java.util.ConcurrentModificationException
```
`remove` в теле цикла изменил `modCount`, и следующий шаг for-each — вызов
`next()` — обнаружил расхождение.

Но проверка срабатывает не всегда. `hasNext()` у `ArrayList` сравнивает только
позицию курсора с размером, а `modCount` не проверяет. Если удалить
предпоследний элемент, `hasNext()` вернёт `false`, цикл закончится без
исключения — и последний элемент просто не будет обработан:
```java
List<String> abc2 = new ArrayList<>(List.of("a", "b", "c"));
List<String> visited = new ArrayList<>();
for (String s : abc2) {
    visited.add(s);
    if (s.equals("b")) abc2.remove(s);
}
System.out.println("посещены: " + visited + " — \"c\" пропущен");
```
```
посещены: [a, b] — "c" пропущен
```
Исключения нет, программа «работает», но элемент `c` молча пропущен. Поэтому
fail-fast — механизм обнаружения ошибок по принципу «лучшей попытки», а не
гарантия: javadoc прямо запрещает строить на нём корректность программы.

#### Fail-safe и weakly consistent итераторы
Конкурентные коллекции не бросают `ConcurrentModificationException`: их
итераторы рассчитаны на изменения во время обхода. В javadoc для них два
разных термина. `CopyOnWriteArrayList` даёт итератор-снимок (snapshot): он
обходит массив на момент своего создания и не видит последующих изменений.

`ConcurrentHashMap` и другие коллекции из `java.util.concurrent` дают weakly
consistent итераторы. Каждый элемент выдаётся не больше одного раза, а
изменения после создания итератора он может как увидеть, так и не увидеть.
Распространённый термин «fail-safe» объединяет оба варианта, но в документации
JDK не используется.

```java
List<String> cow = new CopyOnWriteArrayList<>(List.of("a", "b"));
for (String s : cow) {
    cow.add(s + "!");
}
System.out.println("CopyOnWriteArrayList после add во время обхода: " + cow);
Map<String, Integer> chm = new ConcurrentHashMap<>(Map.of("x", 1, "y", 2));
for (String k : chm.keySet()) {
    chm.put(k + k, 0);
}
System.out.println("ConcurrentHashMap после put во время обхода, size=" + chm.size() + ", без исключения");
```
```
CopyOnWriteArrayList после add во время обхода: [a, b, a!, b!]
ConcurrentHashMap после put во время обхода, size=4, без исключения
```
Итератор `CopyOnWriteArrayList` прошёл только по исходным `a` и `b`, поэтому
цикл не стал бесконечным. Цена снимка — копирование всего массива на каждое
изменение, поэтому `CopyOnWriteArrayList` подходит для редко изменяемых
коллекций с частым чтением, например списков слушателей.

### Безопасная модификация

#### Iterator.remove()
Единственный безопасный способ удалить элемент во время обхода обычным
итератором — `Iterator.remove()`. Он удаляет последний элемент, выданный
`next()`, и синхронизирует `expectedModCount` с коллекцией. Вызывать его можно
один раз на каждый `next()`: повторный вызов бросает `IllegalStateException`.

`ListIterator` для списков умеет больше: `add` вставляет элемент перед курсором,
`set` заменяет последний выданный, можно двигаться назад через `previous()`.
Для `LinkedList` это единственный способ вставлять в середину за O(1).

```java
List<Integer> nums = new ArrayList<>(List.of(1, 2, 3, 4, 5, 6));
Iterator<Integer> it = nums.iterator();
while (it.hasNext()) {
    if (it.next() % 2 == 0) it.remove();
}
System.out.println("Iterator.remove чётных: " + nums);
Iterator<Integer> it2 = nums.iterator();
it2.next();
it2.remove();
it2.remove();   // перехвачено
```
```
Iterator.remove чётных: [1, 3, 5]
второй remove() подряд: java.lang.IllegalStateException
```
Удаление через итератор прошло без исключения. Второй `remove()` без
промежуточного `next()` запрещён: удалять уже нечего.

Изменения через `ListIterator`:
```java
ListIterator<String> li = new ArrayList<>(List.of("a", "c")).listIterator();
List<String> target = new ArrayList<>();
while (li.hasNext()) {
    String s = li.next();
    if (s.equals("a")) li.add("b");
    if (s.equals("c")) li.set("C");
}
while (li.hasPrevious()) target.add(0, li.previous());
System.out.println("ListIterator add/set: " + target);
```
```
ListIterator add/set: [a, b, C]
```
`add` вставил `b` после `a` прямо во время обхода, `set` заменил `c`, а обратный
проход через `previous()` собрал итоговый список.

#### removeIf() в современном коде
С Java 8 у `Collection` есть `removeIf(Predicate)` — удаление по условию одним
вызовом без явного итератора. Это короче, исключает ошибки с индексами и у
`ArrayList` эффективнее: вместо сдвига хвоста на каждое удаление он помечает
удаляемые элементы и уплотняет массив один раз, за O(n).

Для карт `removeIf` вызывают у представлений: `map.entrySet().removeIf(...)`,
`map.values().removeIf(...)`. Родственные методы — `List.replaceAll(UnaryOperator)`
и `Map.replaceAll(BiFunction)` для замены элементов по месту.

```java
List<Integer> nums2 = new ArrayList<>(List.of(1, 2, 3, 4, 5, 6));
nums2.removeIf(x -> x % 2 == 0);
System.out.println("removeIf чётных: " + nums2);
Map<String, Integer> stock = new HashMap<>(Map.of("apple", 5, "pear", 0, "plum", 0));
stock.entrySet().removeIf(e -> e.getValue() == 0);
System.out.println("entrySet().removeIf: " + stock);
```
```
removeIf чётных: [1, 3, 5]
entrySet().removeIf: {apple=5}
```
Тот же результат, что и с `Iterator.remove`, в одну строку. Через `entrySet()`
условие видит и ключ, и значение.

## Частые вопросы на собеседовании

**Q: Почему при удалении в for-each возникает ConcurrentModificationException?**
A: For-each использует итератор, который запоминает `modCount` коллекции. Вызов
`list.remove` увеличивает `modCount`, и следующий `next()` видит расхождение со
своим `expectedModCount`. Удалять нужно через `Iterator.remove()` или
`removeIf`, которые изменяют коллекцию согласованно с итератором.

**Q: Всегда ли изменение во время обхода приводит к исключению?**
A: Нет. Fail-fast — проверка по принципу «лучшей попытки». Например, после
удаления предпоследнего элемента `ArrayList` `hasNext()` вернёт `false`, и цикл
закончится без исключения, пропустив последний элемент. В многопоточном коде
проверка тоже не гарантирует обнаружения гонки, поэтому полагаться на это
исключение нельзя.

**Q: Чем отличаются fail-fast и fail-safe итераторы?**
A: Fail-fast итераторы обычных коллекций бросают
`ConcurrentModificationException` при изменении коллекции в обход итератора.
Итераторы конкурентных коллекций не бросают его: у `CopyOnWriteArrayList` это
снимок на момент создания итератора, у `ConcurrentHashMap` — weakly consistent
обход, который может видеть или не видеть параллельные изменения.

**Q: Как правильно удалить элементы из коллекции по условию?**
A: В современном коде — `removeIf(predicate)`, для карт — через
`entrySet().removeIf`. Если по ходу обхода нужна сложная логика — явный
`Iterator` и `it.remove()`. Цикл по индексу с `remove(i)` и удаление в
for-each — источники ошибок.

## Ловушки и частые ошибки

#### Удаление в цикле по индексу
Цикл `for (int i = 0; i < list.size(); i++)` с `list.remove(i)` не бросает
исключения, но пропускает элементы: после удаления следующий элемент сдвигается
на место `i`, а цикл переходит к `i + 1`.
```java
List<Integer> dup = new ArrayList<>(List.of(2, 2, 3, 4));
for (int i = 0; i < dup.size(); i++) {
    if (dup.get(i) % 2 == 0) dup.remove(i);
}
System.out.println("i++ после remove(i): " + dup + " — вторая двойка пропущена");
```
```
i++ после remove(i): [2, 3] — вторая двойка пропущена
```
Вторая двойка сдвинулась на индекс 0 и не была проверена. Если без индексов не
обойтись, цикл ведут с конца — сдвиг тогда затрагивает уже пройденные элементы.

#### «ConcurrentModificationException — это про потоки»
Исключение чаще всего бросается в однопоточном коде: при удалении в for-each,
при изменении карты внутри `computeIfAbsent`, при вызове метода, который
незаметно меняет ту же коллекцию. Разбирая такую ошибку, ищут не гонку, а место,
где коллекцию меняют во время обхода.

#### Synchronized-обёртка и обход
`Collections.synchronizedList` синхронизирует отдельные вызовы, но не итерацию:
другой поток может изменить список между `hasNext()` и `next()`. Javadoc требует
обходить такую коллекцию внутри `synchronized (list) { ... }`. Альтернатива —
конкурентные коллекции с их собственной семантикой итераторов.

## Связанные темы
- [Иерархия коллекций](01-collections-hierarchy.md) — `Iterable` и `Iterator` как основа for-each.
- [List: ArrayList, LinkedList, Vector](02-list-implementations.md) — `ListIterator` и вставка в `LinkedList`.
- [Map: HashMap изнутри](04-hashmap-internals.md) — `ConcurrentModificationException` в `computeIfAbsent`.
- [Неизменяемые и утилитарные коллекции](07-immutable-collections.md) — `synchronizedList` и его обход.
- Concurrent-коллекции и атомарные переменные (раздел 8) — `CopyOnWriteArrayList` и `ConcurrentHashMap`.
- [Stream API](../07-streams-functional/03-stream-api.md) — фильтрация без изменения исходной коллекции.

## Источники
- [javadoc java.util.ArrayList](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayList.html) — раздел о fail-fast итераторах.
- [javadoc java.util.ConcurrentModificationException](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ConcurrentModificationException.html).
- [javadoc пакета java.util.concurrent](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/package-summary.html) — weakly consistent итераторы.
