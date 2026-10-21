---
title: "Стандартные функциональные интерфейсы"
section: 7
section_title: "Функциональный стиль и Stream API (Java 8+)"
topic_slug: "07-02-functional-interfaces"
roadmap_ref: "Раздел 7 → Стандартные функциональные интерфейсы"
status: not-started
tags: [functional-interfaces, java-util-function, composition, primitive-specializations]
related:
  - "07-01-lambdas-and-closures"
  - "07-03-stream-api"
  - "06-02-bounded-types-and-wildcards"
  - "02-02-variables-and-types"
  - "03-07-comparable-comparator"
last_reviewed: null
---

Пакет `java.util.function` содержит больше сорока функциональных интерфейсов,
но почти все они выводятся из четырёх базовых: поставщик, потребитель, функция
и предикат. На собеседовании ждут, что кандидат знает эти четыре, умеет
комбинировать их через `andThen`/`compose`/`and` и понимает, зачем нужны
примитивные специализации вроде `IntPredicate`.

## Ключевые концепции

### Основные

#### `Supplier<T>`: значение без аргументов
`Supplier<T>` с методом `get()` ничего не принимает и возвращает значение. Это
«отложенное вычисление» или фабрика: `Optional.orElseGet(Supplier)`,
`ThreadLocal.withInitial(Supplier)`, `Objects.requireNonNull(obj, Supplier<String>)`
для ленивого сообщения. Значение вычисляется при каждом вызове `get()`, а не один
раз.

#### `Consumer<T>`: действие без результата
`Consumer<T>` с методом `accept(T)` принимает значение и ничего не возвращает —
это действие с побочным эффектом: вывести, записать, отправить. Его принимают
`Iterable.forEach`, `Optional.ifPresent`, `Stream.forEach`. Метод
`andThen(Consumer)` выполняет два действия подряд над одним значением.

#### `Function<T, R>`: преобразование
`Function<T, R>` с методом `apply(T)` превращает значение одного типа в значение
другого — это аргумент `Stream.map`, `Optional.map`, `Map.computeIfAbsent`. Функции
комбинируются: `f.andThen(g)` — сначала `f`, потом `g`; `f.compose(g)` —
наоборот, сначала `g`. `Function.identity()` возвращает аргумент без изменений,
что удобно в `toMap(identity(), ...)`.

#### `Predicate<T>`: проверка условия
`Predicate<T>` с методом `test(T)` возвращает `boolean` — аргумент `filter`,
`removeIf`, `anyMatch`. Предикаты комбинируют логическими операциями: `and`,
`or`, `negate`, а статический `Predicate.not` (Java 11) делает отрицание удобным
для ссылок на методы: `filter(Predicate.not(String::isBlank))`.

Все четыре интерфейса в работе:
```java
Supplier<String> id = () -> UUID.nameUUIDFromBytes("user-1".getBytes()).toString().substring(0, 8);
Consumer<String> log = s -> System.out.println("  лог: " + s);
Function<String, Integer> length = String::length;
Predicate<String> isEmpty = String::isEmpty;
log.accept("id=" + id.get());
System.out.println("length(\"kotlin\")=" + length.apply("kotlin") + ", isEmpty(\"\")=" + isEmpty.test(""));
```
```
  лог: id=d6d77053
length("kotlin")=6, isEmpty("")=true
```
Четыре интерфейса покрывают четыре формы: «дай», «возьми», «преврати», «проверь».

Композиция функций и предикатов:
```java
Predicate<String> longWord = s -> s.length() > 4;
Predicate<String> startsWithJ = s -> s.startsWith("j");
List<String> words = List.of("java", "javascript", "kotlin", "go", "jq");
System.out.println("long and j: " + words.stream().filter(longWord.and(startsWithJ)).toList());
System.out.println("long or j: " + words.stream().filter(longWord.or(startsWithJ)).toList());
System.out.println("not long: " + words.stream().filter(Predicate.not(longWord)).toList());
Function<Integer, Integer> plus1 = x -> x + 1;
Function<Integer, Integer> times10 = x -> x * 10;
System.out.println("plus1.andThen(times10).apply(2)=" + plus1.andThen(times10).apply(2)
        + ", plus1.compose(times10).apply(2)=" + plus1.compose(times10).apply(2));
```
```
long and j: [javascript]
long or j: [java, javascript, kotlin, jq]
not long: [java, go, jq]
plus1.andThen(times10).apply(2)=30, plus1.compose(times10).apply(2)=21
```
`andThen` и `compose` дают разный результат на одних и тех же функциях:
`(2 + 1) × 10 = 30` против `2 × 10 + 1 = 21`. Порядок применения — частый вопрос
на собеседовании.

### Дополнительные

#### BiFunction, BiConsumer, BiPredicate
Варианты с двумя аргументами: `BiFunction<T, U, R>`, `BiConsumer<T, U>`,
`BiPredicate<T, U>`. Они нужны там, где естественно приходят пары:
`Map.forEach` принимает `BiConsumer<K, V>`, `Map.merge` и `compute` —
`BiFunction`. Интерфейсов на три и больше аргументов в JDK нет: если они нужны,
объявляют свой функциональный интерфейс или группируют аргументы в `record`.

#### UnaryOperator и BinaryOperator
`UnaryOperator<T>` — это `Function<T, T>`, когда вход и выход одного типа
(`List.replaceAll`), а `BinaryOperator<T>` — `BiFunction<T, T, T>` (`reduce`,
`Map.merge`). Отдельные имена делают сигнатуры короче и выразительнее. У
`BinaryOperator` есть фабрики `minBy` и `maxBy` по компаратору.

```java
BiFunction<String, Integer, String> repeat = String::repeat;
BiConsumer<String, Integer> printPair = (k, v) -> System.out.print(k + "=" + v + " ");
BiPredicate<String, Integer> hasLength = (s, n) -> s.length() == n;
UnaryOperator<String> trim = String::strip;
BinaryOperator<Integer> max = BinaryOperator.maxBy(Comparator.naturalOrder());
System.out.println(repeat.apply("ab", 3) + " " + hasLength.test("java", 4) + " [" + trim.apply("  x  ") + "] max=" + max.apply(3, 9));
Map.of("a", 1).forEach(printPair);
System.out.println("— Map.forEach принимает BiConsumer");
```
```
ababab true [x] max=9
a=1 — Map.forEach принимает BiConsumer
```
`String::repeat` стал `BiFunction`: первый аргумент — строка-получатель, второй —
число повторений.

#### Примитивные специализации
Generic-интерфейсы работают только с объектами, поэтому `Function<Integer, Integer>`
упаковывает каждый `int` в `Integer` на входе и выходе. Для частых случаев есть
примитивные версии: `IntPredicate`, `IntUnaryOperator`, `IntFunction<R>` (из
`int`), `ToIntFunction<T>` (в `int`), `IntBinaryOperator`, аналоги для `long` и
`double`, а также `BooleanSupplier`.

На горячих путях разница заметна: упаковка создаёт объекты и нагружает
сборщик мусора. По той же причине у стримов есть `IntStream`, `mapToInt` и
`sum()`, а `Stream<Integer>.reduce(0, Integer::sum)` медленнее. JIT иногда
убирает упаковку (escape analysis), но рассчитывать на это нельзя.

```java
static Function<Integer, Integer> boxed = x -> x * 3 + 1;
static IntUnaryOperator primitive = x -> x * 3 + 1;
// sum += boxed.apply(x) против sum += primitive.applyAsInt(x)
// по 20 млн случайных int, третий проход после прогрева
```
```
20 млн элементов: Function<Integer,Integer> 31 ms, IntUnaryOperator 6 ms (суммы равны: true)

$ java -XX:-DoEscapeAnalysis Boxing
20 млн элементов: Function<Integer,Integer> 77 ms, IntUnaryOperator 7 ms (суммы равны: true)
```
Примитивная версия быстрее в пять раз, а без escape analysis — больше чем в
десять: тогда JIT уже не может убрать временные `Integer`. Цифры зависят от
машины; для серьёзных замеров используют JMH.

## Частые вопросы на собеседовании

**Q: Назовите основные функциональные интерфейсы java.util.function.**
A: `Supplier<T>` — `get()` без аргументов; `Consumer<T>` — `accept(T)` без
результата; `Function<T, R>` — `apply(T)` с преобразованием; `Predicate<T>` —
`test(T)` с `boolean`. От них идут варианты с двумя аргументами (`Bi*`),
операторы с одинаковыми типами (`UnaryOperator`, `BinaryOperator`) и примитивные
специализации (`IntPredicate`, `ToIntFunction` и другие).

**Q: Чем andThen отличается от compose?**
A: `f.andThen(g)` сначала применяет `f`, затем `g` к результату: `g(f(x))`.
`f.compose(g)` — наоборот: `f(g(x))`. Для `f = x + 1` и `g = x × 10` на двойке
получится 30 и 21 соответственно.

**Q: Зачем нужны IntPredicate, ToIntFunction и другие примитивные интерфейсы?**
A: Чтобы избежать автоупаковки: generic-интерфейсы работают только с объектами,
и `Function<Integer, Integer>` создаёт `Integer` на каждом вызове. Примитивные
специализации работают с `int`, `long` и `double` напрямую, что быстрее и не
нагружает сборщик мусора — особенно в стримах и на горячих путях.

**Q: Что делать, если нужна функция с тремя аргументами или бросающая checked-исключение?**
A: Объявить свой функциональный интерфейс с аннотацией `@FunctionalInterface`:
`TriFunction<A, B, C, R>` или `ThrowingFunction<T, R, E extends Exception>`. Для
трёх аргументов часто лучше сгруппировать их в `record` и передать одну
`Function`.

## Ловушки и частые ошибки

#### Supplier вычисляется при каждом вызове
`Supplier` — не кэш: `supplier.get()` дважды выполнит тело дважды. Если значение
дорогое и нужно один раз, его вычисляют сразу или кэшируют явно (ленивое поле,
`computeIfAbsent`). Ошибка встречается, когда `Supplier` передают «чтобы
вычислить лениво», а потом вызывают его в цикле.

#### Функциональный интерфейс в собственном API
Свой интерфейс вместо стандартного стоит заводить, только когда имя добавляет
смысл (`Validator`, `PriceCalculator`) или нужна другая сигнатура. Самописный
`Mapper<A, B>` с одним методом `map` дублирует `Function` и не комбинируется с
`andThen` и стримами.

#### Порядок в andThen и compose
`compose` легко перепутать с `andThen`, а ошибка не видна компилятору, если типы
совпадают, как у `Function<Integer, Integer>`. Цепочки преобразований читаются
естественнее через `andThen` — в порядке выполнения.

## Связанные темы
- [Лямбда-выражения и замыкания](01-lambdas-and-closures.md) — как реализуются эти интерфейсы.
- [Stream API](03-stream-api.md) — где функциональные интерфейсы используются больше всего.
- [Границы типов и wildcard](../06-generics/02-bounded-types-and-wildcards.md) — `Function<? super T, ? extends R>` в сигнатурах JDK.
- [Переменные и типы данных](../02-java-core/02-variables-and-types.md) — автоупаковка и её стоимость.
- [Comparable и Comparator](../03-oop/07-comparable-comparator.md) — `Comparator` как функциональный интерфейс с комбинаторами.

## Источники
- [javadoc пакета java.util.function](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/function/package-summary.html).
- Joshua Bloch, «Effective Java», 3rd ed.: Item 44 «Favor the use of standard functional interfaces».
- Richard Warburton, «Java 8 Lambdas» (O'Reilly).
