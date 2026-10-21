---
title: "Collectors"
section: 7
section_title: "Функциональный стиль и Stream API (Java 8+)"
topic_slug: "07-04-collectors"
roadmap_ref: "Раздел 7 → Collectors"
status: not-started
tags: [collectors, groupingby, tomap, partitioningby, teeing]
related:
  - "07-03-stream-api"
  - "07-05-parallel-streams"
  - "05-04-hashmap-internals"
  - "05-07-immutable-collections"
last_reviewed: null
---

`collect` с готовыми коллекторами — способ превратить поток в коллекцию, строку,
число или карту за одну операцию. На собеседованиях и в реальном коде чаще всего
встречаются `groupingBy` с вложенными коллекторами и `toMap`, у которого есть
неочевидные правила про дубликаты и `null`. Senior также должен понимать, из чего
состоит коллектор и как написать свой.

## Ключевые концепции

### Базовые коллекторы

#### toList, toSet, toMap и их ловушки
`toList()` и `toSet()` собирают элементы в изменяемые коллекции, тип которых не
гарантирован (на практике `ArrayList` и `HashSet`). Неизменяемые варианты —
`toUnmodifiableList/Set/Map`, а конкретный тип коллекции задают через
`toCollection(TreeSet::new)`. С Java 16 у стрима есть и метод `toList()` —
неизменяемый (тема «Неизменяемые и утилитарные коллекции»).

`toMap(keyMapper, valueMapper)` строит карту и строг в двух местах. Повторный
ключ бросает `IllegalStateException`: коллектор не знает, какое значение оставить,
— для этого есть третий аргумент, функция слияния. Значение `null` бросает
`NullPointerException`, потому что внутри используется `Map.merge`. Четвёртый
аргумент задаёт реализацию карты.

```java
record Employee(String name, String dept, int salary) {}
static final List<Employee> STAFF = List.of(
        new Employee("Anna", "dev", 300), new Employee("Ivan", "ops", 200),
        new Employee("Olga", "dev", 250), new Employee("Petr", "dev", 300),
        new Employee("Ira", "qa", 180));
// ...
System.out.println("toSet отделов: " + STAFF.stream().map(Employee::dept).collect(Collectors.toCollection(TreeSet::new)));
STAFF.stream().collect(Collectors.toMap(Employee::dept, Employee::name));   // перехвачено
Map<String, String> byDept = STAFF.stream().collect(Collectors.toMap(
        Employee::dept, Employee::name, (a, b) -> a + "," + b, TreeMap::new));
System.out.println("toMap с merge и TreeMap: " + byDept);
Stream.of("a").collect(Collectors.toMap(Function.identity(), s -> (String) null));   // перехвачено
```
```
toSet отделов: [dev, ops, qa]
toMap с дублем ключа: Duplicate key dev (attempted merging values Anna and Olga)
toMap с merge и TreeMap: {dev=Anna,Olga,Petr, ops=Ivan, qa=Ira}
toMap со значением null: NullPointerException
```
Сообщение об ошибке называет и ключ, и оба конфликтующих значения. Функция
слияния склеила имена, а `TreeMap::new` сделал порядок ключей предсказуемым.

#### joining
`joining()` склеивает строки, `joining(", ")` — через разделитель,
`joining(", ", "[", "]")` — ещё и с префиксом и суффиксом. Внутри — `StringBuilder`,
поэтому это эффективная замена конкатенации в цикле. Работает только с потоком
`CharSequence`: числа сначала превращают в строки через `map(String::valueOf)`.

```java
System.out.println(STAFF.stream().map(Employee::name).collect(Collectors.joining(", ", "[", "]")));
```
```
[Anna, Ivan, Olga, Petr, Ira]
```

### Группировка

#### groupingBy и downstream-коллекторы
`groupingBy(classifier)` раскладывает элементы по ключу и возвращает
`Map<K, List<T>>`. Его сила — во втором аргументе, downstream-коллекторе, который
обрабатывает каждую группу: `counting()`, `mapping(f, toList())`,
`averagingInt`, `maxBy`, `toSet()`. Трёхаргументная форма задаёт ещё и фабрику
карты, например `TreeMap::new` для сортированных ключей.

Ключ-классификатор не может быть `null`: элементы с `null`-ключом вызовут
`NullPointerException`. Группировка на пустом потоке даёт пустую карту.

```java
Map<String, List<String>> names = STAFF.stream().collect(Collectors.groupingBy(Employee::dept, TreeMap::new,
        Collectors.mapping(Employee::name, Collectors.toList())));
System.out.println("имена по отделам: " + names);
Map<String, Long> counts = STAFF.stream().collect(Collectors.groupingBy(Employee::dept, TreeMap::new, Collectors.counting()));
System.out.println("counting: " + counts);
Map<String, Double> avg = STAFF.stream().collect(Collectors.groupingBy(Employee::dept, TreeMap::new, Collectors.averagingInt(Employee::salary)));
System.out.println("averagingInt: " + avg);
Map<String, Optional<Employee>> top = STAFF.stream().collect(Collectors.groupingBy(Employee::dept, TreeMap::new,
        Collectors.maxBy(Comparator.comparingInt(Employee::salary))));
System.out.println("maxBy: " + top.get("dev").map(Employee::name).orElse("-"));
```
```
имена по отделам: {dev=[Anna, Olga, Petr], ops=[Ivan], qa=[Ira]}
counting: {dev=3, ops=1, qa=1}
averagingInt: {dev=283.3333333333333, ops=200.0, qa=180.0}
maxBy: Anna
```
Один и тот же `groupingBy` даёт имена, количество, среднее или максимум в
зависимости от downstream-коллектора. `maxBy` возвращает `Optional`, а при
равенстве зарплат у Anna и Petr остался первый встреченный.

#### partitioningBy
`partitioningBy(predicate)` — частный случай группировки по `boolean`. Отличие
от `groupingBy(e -> условие)` — в результате всегда оба ключа, `true` и `false`,
даже если одна из групп пуста. Это удобно, когда дальше код ожидает обе части.

```java
Map<Boolean, List<String>> rich = STAFF.stream().collect(Collectors.partitioningBy(e -> e.salary() >= 250,
        Collectors.mapping(Employee::name, Collectors.toList())));
System.out.println(rich);
System.out.println("пустой поток: " + Stream.<Employee>empty().collect(Collectors.partitioningBy(e -> e.salary() > 0)));
System.out.println("groupingBy на пустом: " + Stream.<Employee>empty().collect(Collectors.groupingBy(Employee::dept)));
```
```
{false=[Ivan, Ira], true=[Anna, Olga, Petr]}
пустой поток: {false=[], true=[]}
groupingBy на пустом: {}
```
На пустом потоке `partitioningBy` всё равно вернул оба ключа, а `groupingBy` —
пустую карту.

#### summarizingInt, averagingInt, counting
Числовые коллекторы считают агрегаты: `counting()` (результат — `Long`),
`summingInt`, `averagingInt` (результат — `Double`), `minBy`/`maxBy` (результат —
`Optional`). `summarizingInt` за один проход собирает всё сразу — количество,
сумму, минимум, максимум и среднее — в объект `IntSummaryStatistics`.

Как самостоятельный терминал они чаще проигрывают примитивным стримам
(`mapToInt(...).sum()`), но незаменимы как downstream внутри `groupingBy`.

```java
IntSummaryStatistics stats = STAFF.stream().collect(Collectors.summarizingInt(Employee::salary));
System.out.println("summarizingInt: min=" + stats.getMin() + " max=" + stats.getMax() + " sum=" + stats.getSum());
```
```
summarizingInt: min=180 max=300 sum=1230
```

### Продвинутое

#### Свой коллектор через Collector.of
Коллектор — это четыре функции: `supplier` создаёт изменяемый контейнер,
`accumulator` добавляет в него элемент, `combiner` сливает два контейнера (нужен
для параллельных стримов, где у каждого потока свой контейнер), а `finisher`
превращает контейнер в результат. Плюс характеристики: `IDENTITY_FINISH`,
`UNORDERED`, `CONCURRENT`.

`Collector.of(supplier, accumulator, combiner, finisher)` собирает коллектор из
этих частей. Обычно свой коллектор не нужен — хватает комбинаций готовых, — но
понимание четырёх функций объясняет, как работают все остальные и почему
`combiner` должен быть корректным.

```java
Collector<String, StringJoiner, String> csv = Collector.of(
        () -> new StringJoiner(";"),            // supplier
        StringJoiner::add,                      // accumulator
        StringJoiner::merge,                    // combiner (для параллельных стримов)
        StringJoiner::toString);                // finisher
System.out.println(STAFF.stream().map(Employee::name).collect(csv));
System.out.println("параллельно: " + STAFF.parallelStream().map(Employee::name).collect(csv));
```
```
Anna;Ivan;Olga;Petr;Ira
параллельно: Anna;Ivan;Olga;Petr;Ira
```
В параллельном режиме каждый поток собрал свой `StringJoiner`, а `merge` склеил
их в исходном порядке — поэтому результат совпал с последовательным.

#### teeing (Java 12+)
`teeing(c1, c2, merger)` отправляет каждый элемент сразу в два коллектора и
объединяет их результаты функцией `merger`. Так за один проход считают, например,
минимум и максимум или сумму и количество. Без `teeing` пришлось бы обходить
поток дважды или писать свой коллектор.

```java
String range = STAFF.stream().map(Employee::salary).collect(Collectors.teeing(
        Collectors.minBy(Integer::compare),
        Collectors.maxBy(Integer::compare),
        (min, max) -> min.orElseThrow() + ".." + max.orElseThrow()));
System.out.println("диапазон зарплат за один проход: " + range);
```
```
диапазон зарплат за один проход: 180..300
```
Компаратор здесь передан как `Integer::compare`: с `Comparator.naturalOrder()`
вывод типов внутри `teeing` не справляется, и код не компилируется.

## Частые вопросы на собеседовании

**Q: Что будет, если в toMap встретится повторный ключ?**
A: `IllegalStateException` с сообщением «Duplicate key ... (attempted merging values
... and ...)». Чтобы разрешить конфликт, передают третий аргумент — функцию
слияния `(old, new) -> ...`. Кроме того, `toMap` не принимает `null` в значениях
и бросает `NullPointerException`, потому что опирается на `Map.merge`.

**Q: Чем partitioningBy отличается от groupingBy?**
A: `partitioningBy` группирует по предикату и всегда возвращает карту с двумя
ключами, `true` и `false`, даже если одна из групп пуста. `groupingBy` создаёт
ключи только для встретившихся значений классификатора. Оба принимают
downstream-коллектор для обработки групп.

**Q: Как посчитать количество элементов в каждой группе?**
A: `groupingBy(classifier, counting())` — результат `Map<K, Long>`. Аналогично
`summingInt`, `averagingInt`, `mapping(f, toList())` и `maxBy` дают сумму,
среднее, преобразованные элементы и максимум в каждой группе.

**Q: Из чего состоит Collector?**
A: Из четырёх функций: `supplier` создаёт изменяемый контейнер, `accumulator`
добавляет элемент, `combiner` сливает два контейнера при параллельном выполнении,
`finisher` превращает контейнер в результат. Плюс набор характеристик.
`Collector.of` собирает коллектор из этих частей.

**Q: Зачем нужен teeing?**
A: Чтобы за один проход вычислить два независимых результата и объединить их:
минимум и максимум, сумму и количество, два разных отбора. Каждый элемент уходит
в оба коллектора, а функция `merger` строит итог.

## Ловушки и частые ошибки

#### toMap без функции слияния
`toMap(User::email, u -> u)` работает на тестовых данных и падает в проде на
первом дубликате email. Если уникальность ключа не гарантирована схемой данных,
функцию слияния задают явно — и решают, какое значение оставить.

#### Тип коллекции из toList()
`Collectors.toList()` и `toSet()` не гарантируют ни тип, ни изменяемость. Код,
который приводит результат к `ArrayList` или добавляет в него элементы, держится
на детали реализации. Нужна конкретная коллекция — `toCollection(ArrayList::new)`.

#### Вложенные groupingBy без фабрики карты
`groupingBy` по умолчанию собирает в `HashMap`, порядок ключей которой не
определён. Вывод отчёта «по отделам» в тестах внезапно меняет порядок. Для
стабильного порядка передают `TreeMap::new` или `LinkedHashMap::new` вторым
аргументом.

## Связанные темы
- [Stream API](03-stream-api.md) — где вызывается `collect`.
- [Параллельные стримы](05-parallel-streams.md) — зачем коллектору `combiner`.
- [Map: HashMap изнутри](../05-collections/04-hashmap-internals.md) — `merge` и почему `null`-значения запрещены в `toMap`.
- [Неизменяемые и утилитарные коллекции](../05-collections/07-immutable-collections.md) — `toList()` и `toUnmodifiableList()`.

## Источники
- [javadoc java.util.stream.Collectors](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/stream/Collectors.html), [java.util.stream.Collector](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/stream/Collector.html).
- Raoul-Gabriel Urma, Mario Fusco, Alan Mycroft, «Modern Java in Action» (Manning): глава 6 «Collecting data with streams».
- Joshua Bloch, «Effective Java», 3rd ed.: Item 46 «Prefer side-effect-free functions in streams».
