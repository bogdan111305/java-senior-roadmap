---
title: "Set: HashSet, LinkedHashSet, TreeSet"
section: 5
section_title: "Коллекции (Java Collections Framework)"
topic_slug: "05-03-set-implementations"
roadmap_ref: "Раздел 5 → Set: HashSet, LinkedHashSet, TreeSet"
status: not-started
tags: [collections, set, hashset, linkedhashset, treeset, navigableset]
related:
  - "05-04-hashmap-internals"
  - "05-01-collections-hierarchy"
  - "05-08-choosing-collection"
  - "03-06-object-class"
  - "03-07-comparable-comparator"
last_reviewed: null
---

Три основные реализации `Set` различаются тем, какой порядок обхода они
гарантируют и как определяют дубликаты. На собеседовании проверяют, знает ли
кандидат, что `HashSet` — это обёртка над `HashMap`, а `TreeSet` — над
`TreeMap`, и что `TreeSet` считает элементы одинаковыми по компаратору, а не по
`equals`.

## Ключевые концепции

### Реализации

#### HashSet поверх HashMap
`HashSet` не содержит собственной хеш-таблицы: внутри лежит `HashMap`, элементы
множества хранятся как её ключи, а значением для всех служит одна общая
константа-заглушка `PRESENT`. `add(e)` — это `map.put(e, PRESENT) == null`, то
есть «элемента раньше не было». Отсюда всё поведение: O(1) в среднем на
`add`/`contains`/`remove`, один `null`, отсутствие гарантий порядка.

Дубликаты определяются через `hashCode` и `equals` элементов, поэтому их
контракт обязателен (тема «Класс Object»). Порядок обхода зависит от хешей и
текущей ёмкости таблицы и может поменяться после добавления элементов.

```java
HashSet<String> hs = new HashSet<>();
Field mapField = HashSet.class.getDeclaredField("map");          // --add-opens java.base/java.util=ALL-UNNAMED
mapField.setAccessible(true);
Field present = HashSet.class.getDeclaredField("PRESENT");
present.setAccessible(true);
System.out.println("add(\"a\") первый раз: " + hs.add("a") + ", повторно: " + hs.add("a"));
Map<?, ?> inner = (Map<?, ?>) mapField.get(hs);
System.out.println("внутренняя карта: " + inner.getClass().getSimpleName()
        + ", значение по ключу \"a\" == PRESENT: " + (inner.get("a") == present.get(null)));
```
```
add("a") первый раз: true, повторно: false
внутренняя карта: HashMap, значение по ключу "a" == PRESENT: true
```
Повторный `add` вернул `false`: `put` нашёл ключ и вернул старое значение. Внутри
действительно `HashMap`, где у каждого ключа одно и то же значение-заглушка.

#### LinkedHashSet: порядок вставки
`LinkedHashSet` — наследник `HashSet`, внутри которого `LinkedHashMap`. Кроме
хеш-таблицы записи связаны двусвязным списком в порядке добавления, поэтому
обход идёт в порядке вставки. Повторное добавление существующего элемента
порядок не меняет.

Сложность операций та же, что у `HashSet`, а цена — ещё две ссылки на каждую
запись. `LinkedHashSet` выбирают, когда нужна уникальность и предсказуемый
порядок: убрать дубликаты из списка, сохранив исходный порядок, или выдавать
результат в стабильном порядке для тестов и логов.

```java
List<String> words = List.of("pear", "apple", "fig", "banana", "kiwi", "cherry");
System.out.println("HashSet:       " + new HashSet<>(words));
System.out.println("LinkedHashSet: " + new LinkedHashSet<>(words));
System.out.println("TreeSet:       " + new TreeSet<>(words));
LinkedHashSet<String> lhs = new LinkedHashSet<>(words);
lhs.add("pear");   // повторная вставка не меняет порядок
System.out.println("LinkedHashSet после повторного add(\"pear\"): " + lhs);
```
```
HashSet:       [banana, apple, cherry, pear, kiwi, fig]
LinkedHashSet: [pear, apple, fig, banana, kiwi, cherry]
TreeSet:       [apple, banana, cherry, fig, kiwi, pear]
LinkedHashSet после повторного add("pear"): [pear, apple, fig, banana, kiwi, cherry]
```
Одни и те же слова в трёх порядках: по хешам, по вставке и по алфавиту. Порядок
`HashSet` выглядит случайным, и полагаться на него нельзя.

#### TreeSet на красно-чёрном дереве
`TreeSet` хранит элементы в `TreeMap` — сбалансированном красно-чёрном дереве
поиска. Элементы всегда отсортированы: по естественному порядку (`Comparable`)
или по переданному `Comparator`. `add`, `remove` и `contains` — O(log n) в любом
случае, без деградации из-за коллизий.

Важная деталь — дубликаты `TreeSet` определяет через `compareTo` или компаратор,
а не через `equals`. Если они не согласованы, поведение отличается от `HashSet`:
компаратор без учёта регистра склеит `Java` и `java` в один элемент.
`hashCode` для `TreeSet` не нужен вовсе, а `null` естественный порядок не
допускает.

```java
TreeSet<String> ci = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
ci.addAll(List.of("Java", "java", "JAVA", "Kotlin"));
System.out.println("TreeSet(CASE_INSENSITIVE_ORDER): " + ci + ", contains(\"jAvA\"): " + ci.contains("jAvA"));
```
```
TreeSet(CASE_INSENSITIVE_ORDER): [Java, Kotlin], contains("jAvA"): true
```
Три строки, различные по `equals`, для компаратора равны, и в множестве остался
только первый вариант. Такой `TreeSet` удобен как множество «без учёта регистра»,
но нарушает общий контракт `Set`, который опирается на `equals`.

### API TreeSet/NavigableSet

#### floor, ceiling, higher, lower
`TreeSet` реализует `NavigableSet`, и дерево умеет быстро искать не только точное
совпадение, но и ближайший элемент. `floor(x)` — наибольший элемент ≤ x,
`ceiling(x)` — наименьший ≥ x, `lower` и `higher` — то же со строгим
неравенством. Если подходящего элемента нет, возвращается `null`. Все операции
— O(log n).

Так решаются задачи «найти ближайший слот в расписании», «тариф по сумме»,
«ближайшая цена в стакане заявок» — без перебора всех элементов.

```java
TreeSet<Integer> scores = new TreeSet<>(List.of(10, 20, 30, 40, 50));
System.out.println("floor(25)=" + scores.floor(25) + " ceiling(25)=" + scores.ceiling(25)
        + " lower(30)=" + scores.lower(30) + " higher(30)=" + scores.higher(30)
        + " floor(5)=" + scores.floor(5));
```
```
floor(25)=20 ceiling(25)=30 lower(30)=20 higher(30)=40 floor(5)=null
```
`lower(30)` и `higher(30)` пропустили сам элемент 30, а `floor(5)` вернул `null`:
элементов меньше пяти нет. Результат `null` нужно проверять, иначе распаковка в
`int` упадёт с `NullPointerException`.

#### first/last, headSet/tailSet/subSet
`first()` и `last()` возвращают крайние элементы (на пустом множестве —
`NoSuchElementException`), `pollFirst()` и `pollLast()` ещё и удаляют их.
`headSet(to)`, `tailSet(from)` и `subSet(from, to)` возвращают диапазоны: нижняя
граница включается, верхняя — нет, перегрузки с флагами позволяют это
поменять. `descendingSet()` — обратный порядок.

Диапазоны — живые представления, а не копии: элементы, добавленные в исходное
множество, появляются и в представлении, если попадают в диапазон. Добавить в
представление элемент вне его диапазона нельзя.

```java
System.out.println("first=" + scores.first() + " last=" + scores.last()
        + " headSet(30)=" + scores.headSet(30) + " tailSet(30)=" + scores.tailSet(30)
        + " subSet(20, 40)=" + scores.subSet(20, 40) + " descendingSet=" + scores.descendingSet());
SortedSet<Integer> window = scores.subSet(20, 40);
scores.add(25);
System.out.println("subSet — живое представление после scores.add(25): " + window);
window.add(45);   // перехвачено
```
```
first=10 last=50 headSet(30)=[10, 20] tailSet(30)=[30, 40, 50] subSet(20, 40)=[20, 30] descendingSet=[50, 40, 30, 20, 10]
subSet — живое представление после scores.add(25): [20, 25, 30]
window.add(45): java.lang.IllegalArgumentException: key out of range
```
`headSet(30)` не включил 30, а `tailSet(30)` включил. Новый элемент 25 сразу
появился в окне `[20, 40)`, а 45 в это окно добавить нельзя.

## Частые вопросы на собеседовании

**Q: Как устроен HashSet?**
A: Внутри `HashMap`: элементы хранятся как ключи, а значение у всех — общая
константа `PRESENT`. `add` возвращает результат `put(e, PRESENT) == null`. Отсюда
средняя сложность O(1), допустимость одного `null`, требование корректных
`hashCode`/`equals` и отсутствие гарантий порядка.

**Q: Чем отличаются HashSet, LinkedHashSet и TreeSet?**
A: Порядком обхода и сложностью. `HashSet` — без порядка, O(1) в среднем.
`LinkedHashSet` — порядок вставки за счёт двусвязного списка, тоже O(1), но
больше памяти. `TreeSet` — отсортированный порядок на красно-чёрном дереве,
O(log n), и дополнительный API ближайших элементов и диапазонов.

**Q: Как TreeSet определяет дубликаты?**
A: Через `compareTo` элементов или переданный `Comparator`: элементы с
результатом сравнения 0 считаются одинаковыми, `equals` и `hashCode` не
вызываются. Если компаратор не согласован с `equals`, `TreeSet` и `HashSet` с
одними и теми же данными дадут разный размер.

**Q: Зачем нужны floor и ceiling?**
A: Для поиска ближайшего элемента за O(log n) вместо перебора: ближайший слот
в расписании, тариф по сумме покупки, ближайшая точка на шкале. `floor` ищет
наибольший элемент не больше аргумента, `ceiling` — наименьший не меньше, и оба
возвращают `null`, если такого нет.

## Ловушки и частые ошибки

#### Изменяемые элементы в HashSet
Если поле, участвующее в `hashCode`, меняется у элемента, который уже лежит в
`HashSet`, элемент «теряется»: `contains` и `remove` ищут его не в той корзине.
Элементы множеств и ключи карт делают неизменяемыми (пример — в теме «Класс
Object»).

#### Компаратор, несогласованный с equals
`TreeSet` с компаратором по одному полю — например, по зарплате — молча
выбросит всех сотрудников с одинаковой зарплатой, кроме первого. Компаратор для
`TreeSet` и `TreeMap` должен различать все объекты, которые различает `equals`:
добавляют уточняющие критерии через `thenComparing`.

#### Порядок HashSet в тестах
Тест, который сравнивает `hashSet.toString()` со строкой, проходит, пока набор
данных не изменился, и ломается при добавлении элемента или смене версии JDK.
Множества в тестах сравнивают через `equals` с ожидаемым `Set`, а для
стабильного вывода используют `LinkedHashSet` или `TreeSet`.

#### null в TreeSet
`TreeSet` с естественным порядком не принимает `null`: сравнение `null` с
элементом бросает `NullPointerException`. Если `null` возможен, компаратор
оборачивают в `Comparator.nullsFirst` или `nullsLast`.

## Связанные темы
- [Map: HashMap изнутри](04-hashmap-internals.md) — устройство хеш-таблицы, на которой построен `HashSet`.
- [Иерархия коллекций](01-collections-hierarchy.md) — место `Set`, `SortedSet` и `NavigableSet` в JCF.
- [Выбор правильной коллекции](08-choosing-collection.md) — когда какое множество брать.
- [Класс Object](../03-oop/06-object-class.md) — контракт `equals`/`hashCode` и изменяемые ключи.
- [Comparable и Comparator](../03-oop/07-comparable-comparator.md) — согласованность `compareTo` с `equals`.

## Источники
- [javadoc java.util.HashSet](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/HashSet.html), [java.util.TreeSet](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/TreeSet.html), [java.util.NavigableSet](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/NavigableSet.html).
- Thomas H. Cormen и др., «Introduction to Algorithms», глава 13 «Red-Black Trees».
