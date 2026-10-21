---
title: "Неизменяемые и утилитарные коллекции"
section: 5
section_title: "Коллекции (Java Collections Framework)"
topic_slug: "05-07-immutable-collections"
roadmap_ref: "Раздел 5 → Неизменяемые и утилитарные коллекции"
status: not-started
tags: [collections, immutability, list-of, arrays-aslist, collections-utils]
related:
  - "03-01-encapsulation"
  - "05-01-collections-hierarchy"
  - "05-06-iterators-and-modification"
  - "07-03-stream-api"
  - "07-04-collectors"
last_reviewed: null
---

В Java есть несколько способов получить «неизменяемый» список, и ведут они себя
по-разному: одни действительно неизменяемы, другие — лишь окно в изменяемую
коллекцию, третьи запрещают менять размер, но разрешают менять элементы. На
собеседовании проверяют, понимает ли кандидат эту разницу и знает ли сюрпризы
`List.of`: запрет `null` и случайный порядок `Set.of`.

## Ключевые концепции

### Иммутабельность

#### List.of, Set.of, Map.of (Java 9+)
Фабрики `List.of`, `Set.of`, `Map.of` и `Map.ofEntries` создают по-настоящему
неизменяемые коллекции: любые изменяющие методы бросают
`UnsupportedOperationException`, и исходной изменяемой коллекции, через которую
их можно поменять, не существует. Они компактнее обычных — для 0–2 элементов
есть отдельные классы без массива.

У них строгие правила. `null` запрещён везде: и как элемент, и даже как
аргумент `contains(null)`. `Set.of` и `Map.of` бросают
`IllegalArgumentException` на дубликатах. Порядок обхода `Set.of` и `Map.of`
намеренно перемешивается при каждом запуске JVM, чтобы код не начал
зависеть от него.

```java
static void tryRun(String label, Runnable r) { /* выполнить и напечатать исключение или ok */ }
// ...
List<String> list = List.of("a", "b");
tryRun("List.of(...).add", () -> list.add("c"));
tryRun("List.of(\"a\", null)", () -> List.of("a", null));
tryRun("List.of(...).contains(null)", () -> list.contains(null));
tryRun("Set.of(\"a\", \"a\")", () -> Set.of("a", "a"));
tryRun("Map.of(\"k\", 1, \"k\", 2)", () -> Map.of("k", 1, "k", 2));
System.out.println("Set.of порядок обхода: " + Set.of("one", "two", "three", "four", "five"));
```
```
List.of(...).add: UnsupportedOperationException
List.of("a", null): NullPointerException
List.of(...).contains(null): NullPointerException
Set.of("a", "a"): IllegalArgumentException — duplicate element: a
Map.of("k", 1, "k", 2): IllegalArgumentException — duplicate key: k
Set.of порядок обхода: [four, one, five, three, two]
```
Даже вопрос «есть ли здесь `null`» `List.of` считает ошибкой. Порядок обхода
`Set.of` в четырёх запусках этого кода был четырьмя разными:
`[four, one, five, three, two]`, `[two, four, one, five, three]`,
`[two, three, five, one, four]`, `[one, four, two, three, five]`.

#### Collections.unmodifiableList — только обёртка
`Collections.unmodifiableList`, `unmodifiableSet` и `unmodifiableMap` не копируют
данные, а возвращают представление-обёртку. Через неё нельзя писать, но
исходная коллекция остаётся изменяемой, и её изменения видны через обёртку.
Это защита от изменения конкретным получателем, а не гарантия неизменности
данных.

Чтобы получить неизменяемый снимок, используют `List.copyOf`, `Set.copyOf`,
`Map.copyOf` (Java 10): они копируют данные, а если коллекция уже неизменяемая,
возвращают её же без копирования. Пример с обёрткой и копией — в теме
«Инкапсуляция»: изменение исходного списка видно через `unmodifiableList` и
не видно в `List.copyOf`.

#### Arrays.asList — фиксированный размер
`Arrays.asList(array)` возвращает список-представление поверх массива. Размер
у него фиксированный: `add` и `remove` бросают `UnsupportedOperationException`.
А `set` разрешён и пишет прямо в массив — изменения видны в обе стороны. `null`
допускается.

Этот список удобен для быстрого создания тестовых данных и для передачи массива
в API, ожидающий `List`. Нужен настоящий изменяемый список — оборачивают:
`new ArrayList<>(Arrays.asList(...))`. Особый случай — `Arrays.asList(int[])`:
примитивный массив становится одним элементом списка (тема «Массивы»).

```java
String[] arr = {"x", "y", "z"};
List<String> view = Arrays.asList(arr);
view.set(0, "X");
arr[2] = "Z";
System.out.println("asList после set(0) и arr[2]=Z: " + view + ", массив: " + Arrays.toString(arr));
tryRun("Arrays.asList(...).add", () -> view.add("w"));
tryRun("Arrays.asList(...).remove(0)", () -> view.remove(0));
```
```
asList после set(0) и arr[2]=Z: [X, y, Z], массив: [X, y, Z]
Arrays.asList(...).add: UnsupportedOperationException
Arrays.asList(...).remove(0): UnsupportedOperationException
```
Изменение через список попало в массив, изменение массива — в список. Менять
размер нельзя ни так, ни так.

#### Stream.toList() и Collectors.toList()
Стримы тоже порождают коллекции с разной изменяемостью. `Stream.toList()`
(Java 16) возвращает неизменяемый список, но, в отличие от `List.of`,
допускает `null`. `collect(Collectors.toList())` по факту возвращает
`ArrayList`, хотя спецификация не гарантирует ни тип, ни изменяемость.

Если результат стрима потом дополняют, нужен явный
`Collectors.toCollection(ArrayList::new)`. Если требуется неизменяемость —
`toList()` или `Collectors.toUnmodifiableList()`, который, в отличие от
`toList()`, запрещает `null`.

```java
List<Integer> a = Stream.of(1, 2, 3).toList();
List<Integer> b = Stream.of(1, 2, 3).collect(Collectors.toList());
tryRun("Stream.toList().add", () -> a.add(4));
tryRun("Collectors.toList().add", () -> b.add(4));
System.out.println("Collectors.toList() вернул " + b.getClass().getSimpleName() + ": " + b);
tryRun("Stream.of(1, null).toList()", () -> Stream.of(1, null).toList());
```
```
Stream.toList().add: UnsupportedOperationException
Collectors.toList().add: ok
Collectors.toList() вернул ArrayList: [1, 2, 3, 4]
Stream.of(1, null).toList(): ok
```
Замена `collect(Collectors.toList())` на короткий `toList()` при рефакторинге
меняет поведение: код, который потом добавлял элементы в результат, начнёт
падать.

### Утилиты

#### Collections: сортировка, пустые и служебные коллекции
Класс `Collections` — набор статических утилит. Алгоритмы: `sort`,
`binarySearch` (только для отсортированного списка), `reverse`, `shuffle`
(с `Random` для воспроизводимости), `frequency`, `disjoint`. Фабрики:
`emptyList`, `singletonList`, `nCopies` — неизменяемые и экономные по памяти.

Обёртки `synchronizedList`, `synchronizedMap` и другие синхронизируют каждый
метод, но не обход: итерацию нужно оборачивать в `synchronized` по самой
обёртке. В новом коде вместо них чаще берут конкурентные коллекции.

```java
List<Integer> nums = new ArrayList<>(List.of(5, 3, 8, 1, 9, 2));
Collections.sort(nums);
System.out.println("sort: " + nums + ", binarySearch(8)=" + Collections.binarySearch(nums, 8));
Collections.reverse(nums);
System.out.println("reverse: " + nums);
Collections.shuffle(nums, new Random(42));
System.out.println("shuffle(Random(42)): " + nums);
System.out.println("frequency: " + Collections.frequency(List.of("a", "b", "a"), "a")
        + ", nCopies: " + Collections.nCopies(3, "ab") + ", disjoint: " + Collections.disjoint(List.of(1, 2), List.of(3)));
tryRun("Collections.emptyList().add", () -> Collections.emptyList().add(null));
List<String> sync = Collections.synchronizedList(new ArrayList<>(List.of("a", "b")));
synchronized (sync) {          // обход synchronizedList — только под его монитором
    for (String s : sync) System.out.print(s + " ");
}
```
```
sort: [1, 2, 3, 5, 8, 9], binarySearch(8)=4
reverse: [9, 8, 5, 3, 2, 1]
shuffle(Random(42)): [8, 9, 2, 1, 3, 5]
frequency: 2, nCopies: [ab, ab, ab], disjoint: true
Collections.emptyList().add: UnsupportedOperationException
a b — обход synchronizedList под synchronized(sync)
```
`shuffle` с фиксированным `Random(42)` даёт один и тот же порядок при каждом
запуске — так перемешивание делают воспроизводимым в тестах.

#### Comparator и Collections.max/min
`Collections.max` и `min` находят экстремум за один проход, O(n), — по
естественному порядку или по переданному `Comparator`. Сортировать коллекцию
ради одного максимума — O(n log n) и лишняя работа. На пустой коллекции оба
метода бросают `NoSuchElementException`, поэтому в стримах удобнее
`stream().max(comparator)`, возвращающий `Optional`.

```java
System.out.println("max=" + Collections.max(nums) + ", min=" + Collections.min(nums)
        + ", max по |x - 5|: " + Collections.max(nums, Comparator.comparingInt(x -> Math.abs(x - 5))));
tryRun("Collections.max(пустой)", () -> Collections.max(new ArrayList<Integer>()));
```
```
max=9, min=1, max по |x - 5|: 9
Collections.max(пустой): NoSuchElementException
```
С компаратором `max` ищет не наибольшее число, а элемент с наибольшим значением
выражения — здесь самый удалённый от пятёрки. У 9 и 1 расстояние одинаковое,
и вернулся встреченный первым.

## Частые вопросы на собеседовании

**Q: Чем List.of отличается от Collections.unmodifiableList?**
A: `List.of` создаёт по-настоящему неизменяемый список: изменить его нельзя
никаким способом. `unmodifiableList` — лишь обёртка над существующим списком:
через неё нельзя писать, но изменения исходного списка через неё видны. Кроме
того, `List.of` запрещает `null`, а обёртка принимает то, что лежит в исходном
списке.

**Q: Что не так с Arrays.asList?**
A: Это список фиксированного размера поверх массива: `add` и `remove` бросают
`UnsupportedOperationException`, а `set` и изменения массива видны в обе
стороны. Для `int[]` он создаёт список из одного элемента — самого массива.
Для изменяемого списка его оборачивают в `new ArrayList<>(...)`.

**Q: Почему порядок обхода Set.of меняется между запусками?**
A: Реализации `Set.of` и `Map.of` намеренно перемешивают порядок с помощью
случайной «соли», выбираемой при старте JVM. Так авторы JDK не дают коду
зависеть от порядка, который не гарантирован. Нужен порядок — используют
`LinkedHashSet` или `TreeSet`.

**Q: В чём разница между Stream.toList() и Collectors.toList()?**
A: `Stream.toList()` возвращает неизменяемый список и допускает `null`.
`Collectors.toList()` на практике возвращает изменяемый `ArrayList`, но
спецификация этого не гарантирует. Если результат будут изменять, используют
`Collectors.toCollection(ArrayList::new)`.

## Ловушки и частые ошибки

#### contains(null) на List.of
Код, который проверяет `list.contains(null)` или ищет `indexOf(null)`, работает
со всеми привычными списками, но падает с `NullPointerException` на `List.of`,
`Set.of` и `Map.of`. Если список приходит снаружи и может быть неизменяемым,
проверку на `null` делают до поиска.

#### «Защитил данные через unmodifiableList»
Поле, отданное наружу через `Collections.unmodifiableList(this.items)`,
защищено от изменения получателем, но сам объект продолжает его менять — и
получатель увидит изменения. Для неизменяемого снимка нужен `List.copyOf`.

#### Рефакторинг collect(toList()) → toList()
Замена `collect(Collectors.toList())` на короткий `toList()` выглядит
равносильной, и её легко сделать массово при обновлении JDK. Но результат
становится неизменяемым. Код, который
сортирует или дополняет результат, после такой замены падает в рантайме.

## Связанные темы
- [Инкапсуляция](../03-oop/01-encapsulation.md) — пример `unmodifiableList` против `List.copyOf` и защитное копирование.
- [Массивы](../02-java-core/04-arrays.md) — `Arrays.asList(int[])` и `Arrays.sort`.
- [Иерархия коллекций](01-collections-hierarchy.md) — необязательные операции и `UnsupportedOperationException`.
- [Итераторы и модификация коллекций](06-iterators-and-modification.md) — обход `synchronizedList`.
- Stream API и Collectors (раздел 7) — `toList`, `toUnmodifiableList`, `toCollection`.

## Источники
- [javadoc java.util.List](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/List.html) — раздел «Unmodifiable Lists».
- [JEP 269: Convenience Factory Methods for Collections](https://openjdk.org/jeps/269).
- [javadoc java.util.Collections](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Collections.html).
- [javadoc Stream.toList()](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/stream/Stream.html#toList()).
