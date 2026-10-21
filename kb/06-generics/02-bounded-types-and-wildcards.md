---
title: "Границы типов и wildcard"
section: 6
section_title: "Generics (обобщённое программирование)"
topic_slug: "06-02-bounded-types-and-wildcards"
roadmap_ref: "Раздел 6 → Границы типов и wildcard"
status: not-started
tags: [generics, bounded-types, wildcards, pecs, variance]
related:
  - "06-01-generics-basics"
  - "06-03-generics-pitfalls"
  - "02-04-arrays"
  - "03-07-comparable-comparator"
  - "05-07-immutable-collections"
  - "07-02-functional-interfaces"
last_reviewed: null
---

Границы типов и wildcard — самая «академическая» часть generics, и именно её
спрашивают, чтобы отличить тех, кто пишет API, от тех, кто им только
пользуется. Ключевые идеи — инвариантность generics, правило PECS и то, зачем в
сигнатуре `Collections.max` стоит странное `Comparable<? super T>`.

## Ключевые концепции

### Bounded types

#### Верхняя граница: `<T extends Comparable<T>>`
Параметр без границы — это любой ссылочный тип, и внутри метода у `T` доступны
только методы `Object`. Верхняя граница `<T extends Comparable<T>>` сужает
допустимые типы и одновременно открывает их методы: у `T` можно вызвать
`compareTo`. Ключевое слово `extends` здесь означает и наследование класса, и
реализацию интерфейса.

Граница участвует в стирании: `T extends Comparable<T>` в байткоде становится
`Comparable`, а не `Object`. Без границы метод поиска максимума вообще не смог бы
сравнить элементы.

На практике граница `Comparable<T>` слишком строга. Если `Fruit implements
Comparable<Fruit>`, а `Apple extends Fruit`, то `Apple` сравнима с `Fruit`, но не
реализует `Comparable<Apple>`, и `T extends Comparable<T>` для неё не подойдёт.
Поэтому в JDK пишут `<T extends Comparable<? super T>>`: «сравнима с T или с
любым его предком».

```java
static class Fruit implements Comparable<Fruit> {
    final int weight;
    Fruit(int weight) { this.weight = weight; }
    public int compareTo(Fruit o) { return Integer.compare(weight, o.weight); }
    public String toString() { return getClass().getSimpleName() + "(" + weight + ")"; }
}
static class Apple extends Fruit { Apple(int w) { super(w); } }

static <T extends Comparable<? super T>> T max(List<? extends T> list) {
    T best = list.get(0);
    for (T t : list) if (t.compareTo(best) > 0) best = t;
    return best;
}
// ...
List<Apple> apples = List.of(new Apple(150), new Apple(210), new Apple(180));
System.out.println("max(apples)=" + max(apples));
System.out.println("Collections.max(apples)=" + Collections.max(apples));
```
```
max(apples)=Apple(210)
Collections.max(apples)=Apple(210)
```
Со строгой границей `<T extends Comparable<T>>` тот же вызов не компилируется:
```java
static <T extends Comparable<T>> T strictMax(List<T> list) { return list.get(0); }
// ...
Apple a = strictMax(apples);
```
```
WildFail.java:22: error: method strictMax in class WildFail cannot be applied to given types;
        Apple a = strictMax(apples);
                  ^
  required: List<T>
  found:    List<Apple>
  reason: inference variable T has incompatible equality constraints Fruit,Apple
```
Компилятор не нашёл `T`: из списка выходит `Apple`, а из `Comparable<Fruit>` —
`Fruit`. Граница `Comparable<? super T>` разрешает это противоречие.

#### Множественные границы: `<T extends A & B>`
Параметр может иметь несколько границ: один класс и любое число интерфейсов,
перечисленных через `&`. Класс, если он есть, обязан стоять первым. Внутри
метода у `T` доступны методы всех границ, а стирается параметр до первой из
них.

Так выражают требования, которые не укладываются в один тип: «число, которое
можно сравнивать» — `<T extends Number & Comparable<T>>`. Порядок границ влияет на
байткод: при стирании до `Number` вызовы методов `Comparable` компилятор
дополняет приведением.

```java
static <T extends Number & Comparable<T>> T clampMax(T a, T b) {
    return a.compareTo(b) >= 0 ? a : b;    // методы Comparable
}
static double half(Number n) { return n.doubleValue() / 2; }
// ...
System.out.println("clampMax(3, 9)=" + clampMax(3, 9) + ", half(...)=" + half(clampMax(3.5, 1.5)));
System.out.println("стирание clampMax: " + Wild.class.getDeclaredMethod("clampMax", Number.class, Number.class));
```
```
clampMax(3, 9)=9, half(...)=1.75
стирание clampMax: static java.lang.Number Wild.clampMax(java.lang.Number,java.lang.Number)
```
Результат `clampMax` — одновременно `Comparable` и `Number`, поэтому его можно
передать в `half(Number)`. В байткоде сигнатура стёрта до первой границы —
`Number`.

### Wildcard

#### Инвариантность: зачем нужны wildcard
Generics инвариантны: `List<Integer>` не является подтипом `List<Number>`, хотя
`Integer` — подтип `Number`. Иначе через ссылку `List<Number>` в список целых
можно было бы положить `Double`. Массивы устроены наоборот — ковариантно — и
платят за это `ArrayStoreException` в рантайме (тема «Массивы»).

Но инвариантность мешает писать общие методы: `sum(List<Number>)` не примет
`List<Integer>`. Wildcard `?` задаёт «семейство» типов: `List<? extends Number>`
— список чего-то, что является `Number` или его подтипом. Цена гибкости —
ограничения на операции с таким списком.

```java
List<Integer> ints = new ArrayList<>();
List<Number> nums = ints;
```
```
WildFail.java:13: error: incompatible types: List<Integer> cannot be converted to List<Number>
        List<Number> nums = ints;
                            ^
```
Присваивание запрещено ещё на этапе компиляции — так generics исключают ту
ошибку, которую массивы ловят только в рантайме.

#### ? extends Type — чтение (producer)
`List<? extends Number>` может ссылаться на `List<Integer>`, `List<Double>` или
`List<Number>`. Читать из него безопасно: любой элемент — какой-то `Number`.
Писать нельзя: компилятор не знает, список чего именно перед ним, и положить
`Integer` в возможный `List<Double>` не даст. Исключение — `null`, который
подходит под любой тип.

```java
static double sum(List<? extends Number> nums) {          // producer: только читаем
    double total = 0;
    for (Number n : nums) total += n.doubleValue();
    return total;
}
// ...
System.out.println("sum(ints)=" + sum(List.of(1, 2, 3)) + ", sum(doubles)=" + sum(List.of(1.5, 2.5)));
List<? extends Number> producer = new ArrayList<>(List.of(1, 2, 3));
producer.add(null);
System.out.println("в ? extends можно добавить только null: " + producer);
```
```
sum(ints)=6.0, sum(doubles)=4.0
в ? extends можно добавить только null: [1, 2, 3, null]
```
Один метод принял и `List<Integer>`, и `List<Double>`. Попытка добавить число
не компилируется:
```
WildFail.java:16: error: incompatible types: int cannot be converted to CAP#1
        producer.add(1);
                     ^
  where CAP#1 is a fresh type-variable:
    CAP#1 extends Number from capture of ? extends Number
```
`CAP#1` — «захваченный» неизвестный тип: компилятор знает только, что это
какой-то подтип `Number`, и поэтому не может проверить, подходит ли `1`.

#### ? super Type — запись (consumer)
`List<? super Integer>` может ссылаться на `List<Integer>`, `List<Number>` или
`List<Object>`. Писать в него `Integer` безопасно: такой список примет целое
число в любом случае. Читать можно только как `Object`: что за предок `Integer`
перед нами, неизвестно.

```java
static void fillWithOnes(List<? super Integer> target, int n) {   // consumer: только пишем
    for (int i = 0; i < n; i++) target.add(1);
}
// ...
List<Number> numbers = new ArrayList<>();
List<Object> objects = new ArrayList<>();
fillWithOnes(numbers, 2);
fillWithOnes(objects, 1);
objects.add("строка");
List<? super Integer> consumer = objects;
Object first = consumer.get(0);           // читаем только как Object
System.out.println("numbers=" + numbers + ", objects=" + objects + ", consumer.get(0) как Object: " + first);
```
```
numbers=[1, 1], objects=[1, строка], consumer.get(0) как Object: 1
```
Метод заполнил и `List<Number>`, и `List<Object>`. Прочитать элемент как
`Integer` компилятор не даст — в списке может лежать и строка:
```
WildFail.java:19: error: incompatible types: CAP#1 cannot be converted to Integer
        Integer x = consumer.get(0);
                                ^
  where CAP#1 is a fresh type-variable:
    CAP#1 extends Object super: Integer from capture of ? super Integer
```

#### Принцип PECS: Producer Extends, Consumer Super
PECS (Joshua Bloch, Effective Java) — правило выбора wildcard для параметров
метода. Если параметр производит значения, которые метод читает, — `? extends T`.
Если потребляет значения, которые метод записывает, — `? super T`. Если и то и
другое — точный тип `T` без wildcard.

Классический пример — `Collections.copy(List<? super T> dest, List<? extends T>
src)`: источник отдаёт элементы, приёмник их принимает. Благодаря этому можно
копировать `List<Integer>` в `List<Number>` или `List<Object>`. Wildcard ставят в
параметры, но не в возвращаемый тип: иначе он «просочится» к вызывающему коду.

```java
List<Number> dest = new ArrayList<>(List.of(0, 0, 0, 0));
Collections.copy(dest, List.of(7, 8));    // T = Integer
System.out.println("dest после copy: " + dest);
List<Object> sink = new ArrayList<>(List.of("x", "y", "z"));
Collections.copy(sink, List.of(1.5));
System.out.println("sink после copy: " + sink);
```
```
dest после copy: [7, 8, 0, 0]
sink после copy: [1.5, y, z]
```
Целые скопированы в список чисел, `Double` — в список объектов. Без wildcard
`copy` требовал бы, чтобы оба списка имели один и тот же тип элементов.

#### Неограниченный wildcard и захват
`List<?>` — список неизвестного типа. Из него можно читать `Object` и вызывать
методы, не зависящие от типа: `size`, `clear`, `remove`. Писать нельзя ничего,
кроме `null`. В отличие от raw `List`, это полностью проверяемый тип, а в отличие
от `List<Object>`, он принимает `List<String>` и любой другой список.

Иногда метод с `List<?>` всё-таки должен записать в список его же элементы —
например, поменять два местами. Напрямую не получится: для компилятора каждое
обращение к `list` — новый неизвестный тип. Решение — приватный generic-метод
helper, который «захватывает» `?` в именованный параметр `E` (wildcard capture).

```java
static void swap(List<?> list, int i, int j) { swapHelper(list, i, j); }
private static <E> void swapHelper(List<E> list, int i, int j) {
    E tmp = list.get(i);
    list.set(i, list.get(j));
    list.set(j, tmp);
}
// ...
List<String> letters = new ArrayList<>(List.of("a", "b", "c"));
swap(letters, 0, 2);
System.out.println("swap через helper: " + letters);
```
```
swap через helper: [c, b, a]
```
Публичная сигнатура осталась простой — `swap(List<?>, int, int)`, как у
`Collections.swap`. Без helper тело метода не компилируется:
`Object cannot be converted to CAP#1`.

## Частые вопросы на собеседовании

**Q: Объясните PECS на примере Collections.copy.**
A: Сигнатура `copy(List<? super T> dest, List<? extends T> src)`. Источник —
producer: из него только читают, поэтому `? extends T` позволяет передать список
любого подтипа. Приёмник — consumer: в него только пишут, поэтому `? super T`
позволяет передать список любого предка. В итоге `List<Integer>` можно
скопировать в `List<Number>` и `List<Object>`.

**Q: Почему `List<Integer>` не является подтипом `List<Number>`?**
A: Иначе через ссылку `List<Number>` в список целых можно было бы добавить
`Double`, и типобезопасность рухнула бы. Generics инвариантны и ловят это при
компиляции, а массивы ковариантны и ловят ту же ошибку только в рантайме через
`ArrayStoreException`. Для гибких методов используют wildcard `? extends`.

**Q: Зачем в `Collections.max` граница `<T extends Comparable<? super T>>`?**
A: Чтобы работать с подклассами, которые наследуют `compareTo` от предка. Если
`Fruit implements Comparable<Fruit>`, то `Apple extends Fruit` реализует
`Comparable<Fruit>`, а не `Comparable<Apple>`. Строгая граница
`Comparable<T>` такой тип не примет, а `Comparable<? super T>` разрешает
сравнимость с любым предком.

**Q: Почему нельзя создать `List<T>[]` или `List<String>[]`?**
A: Массивы проверяют тип элементов в рантайме, а параметр типа стёрт: массив
знал бы только `List`. Тогда в `List<String>[]` можно было бы положить
`List<Integer>` без `ArrayStoreException`, и ошибка вылетела бы при чтении строки.
Поэтому компилятор запрещает `new List<String>[10]` с ошибкой «generic array
creation»; вместо массивов используют `List<List<String>>`.

**Q: Чем `List<?>` отличается от `List<Object>` и от raw `List`?**
A: `List<Object>` принимает только списки объектов и позволяет писать в них
что угодно. `List<?>` принимает любой список, но писать в него нельзя, кроме
`null`. Raw `List` тоже принимает любой список, но отключает проверки
компилятора — писать в него можно что угодно, и ошибка вылетит позже.

## Ловушки и частые ошибки

#### Wildcard в возвращаемом типе
Метод `List<? extends Number> numbers()` заставляет вызывающий код работать с
неизвестным типом: в результат нельзя добавлять, а присвоить его в
`List<Number>` нельзя без приведения. Wildcard — инструмент для параметров, а
возвращают конкретный тип.

#### extends вместо super у приёмника
Метод `addAll(List<? extends T> target, ...)`, который пишет в `target`, не
скомпилируется, а с точным `List<T>` — не примет `List<Object>`. Перед выбором
wildcard задают вопрос из PECS: параметр отдаёт данные методу или принимает
их?

#### Строгая граница `Comparable<T>`
`<T extends Comparable<T>>` выглядит правильно и работает на `String` и
`Integer`, но ломается на иерархиях, где `compareTo` объявлен в предке. Для
библиотечного кода граница — `Comparable<? super T>`, как в
`Collections.sort` и `Collections.max`.

## Связанные темы
- [Основы generics](01-generics-basics.md) — параметры типов и стирание.
- [Ограничения и подводные камни generics](03-generics-pitfalls.md) — generic-массивы и heap pollution.
- [Массивы](../02-java-core/04-arrays.md) — ковариантность массивов и `ArrayStoreException`.
- [Comparable и Comparator](../03-oop/07-comparable-comparator.md) — `compareTo` и согласованность с `equals`.
- [Неизменяемые и утилитарные коллекции](../05-collections/07-immutable-collections.md) — `Collections.copy`, `max`, `min`.
- [Стандартные функциональные интерфейсы](../07-streams-functional/02-functional-interfaces.md) — `Function<? super T, ? extends R>` в сигнатурах JDK.

## Источники
- [JLS §4.5.1: Type Arguments of Parameterized Types](https://docs.oracle.com/javase/specs/jls/se21/html/jls-4.html#jls-4.5.1), [§4.4: Type Variables](https://docs.oracle.com/javase/specs/jls/se21/html/jls-4.html#jls-4.4).
- [The Java Tutorials: Wildcards](https://docs.oracle.com/javase/tutorial/java/generics/wildcards.html), [Wildcard Capture and Helper Methods](https://docs.oracle.com/javase/tutorial/java/generics/capture.html).
- Joshua Bloch, «Effective Java», 3rd ed.: Item 28 «Prefer lists to arrays», Item 31 «Use bounded wildcards to increase API flexibility».
