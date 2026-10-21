---
title: "Comparable и Comparator"
section: 3
section_title: "Объектно-ориентированное программирование"
topic_slug: "03-07-comparable-comparator"
roadmap_ref: "Раздел 3 → Comparable и Comparator"
status: not-started
tags: [comparable, comparator, sorting, treemap, contract]
related:
  - "02-04-arrays"
  - "03-06-object-class"
  - "05-03-set-implementations"
  - "07-02-functional-interfaces"
  - "07-03-stream-api"
last_reviewed: null
---

`Comparable` и `Comparator` — два способа задать порядок объектов: встроенный
в сам класс и внешний. Синтаксис знают все, поэтому на собеседовании
проверяют детали: контракт сравнения и что ломается при его нарушении, почему
нельзя сравнивать вычитанием, что делает `reversed()` в цепочке и как
несогласованность с `equals` меняет поведение `TreeSet`.

## Ключевые концепции

### Comparable

#### compareTo и естественный порядок
`Comparable<T>` — интерфейс с одним методом `int compareTo(T o)`. Класс,
реализующий его, объявляет свой естественный порядок (natural ordering):
`String` сравнивается лексикографически, числа — по величине, `LocalDate` —
хронологически. Этот порядок используют без дополнительных параметров
`Collections.sort(list)`, `Arrays.sort`, `TreeSet`, `TreeMap` и
`Stream.sorted()`.

Естественный порядок у класса может быть только один, и он становится частью
публичного контракта класса. Поэтому `Comparable` реализуют, когда порядок
очевиден и единственно разумен: для денег, дат, версий, идентификаторов. Если
сортировать нужно по-разному в разных местах, это работа для `Comparator`.

#### Контракт: знак результата
Важен только знак результата: отрицательное число — «меньше», ноль —
«равно», положительное — «больше». Конкретное значение (`-1` или `-42`) не
имеет смысла, и полагаться на него нельзя. Из этого же следует, что порядок
можно развернуть, только поменяв аргументы местами, а не умножая результат
на `-1` (`-Integer.MIN_VALUE` равно самому себе).

Как и `equals`, `compareTo` должен задавать корректное отношение. Оно
антисимметрично: `sgn(a.compareTo(b)) == -sgn(b.compareTo(a))`. Оно
транзитивно: из `a > b` и `b > c` следует `a > c`. Ноль заменяем: если
`a.compareTo(b) == 0`, то `a` и `b` сравниваются с любым `c` одинаково.

Нарушение контракта обнаруживает сама сортировка:
```java
// Компаратор, нарушающий контракт: никогда не возвращает 0 и не антисимметричен
Comparator<Integer> broken = (a, b) -> a < b ? -1 : 1;
Random r = new Random(0);
List<Integer> list = new ArrayList<>();
for (int i = 0; i < 100; i++) list.add(r.nextInt(5));
try {
    list.sort(broken);
} catch (IllegalArgumentException e) {
    System.out.println(e.getMessage());
}
```
```
Comparison method violates its general contract!
```
Для равных `a` и `b` такой компаратор говорит, что `a > b` и одновременно
`b > a`. TimSort в процессе слияния замечает противоречие и бросает
исключение. Оно появляется не всегда, а в зависимости от данных и их
количества, поэтому такой баг легко пропустить в тестах на маленьких списках.

#### Согласованность с equals
Желательно, но не обязательно, чтобы `compareTo` возвращал ноль ровно тогда,
когда `equals` возвращает `true`. Нарушение этого правила не ошибка само по
себе, но меняет поведение сортированных коллекций: `TreeSet` и `TreeMap`
определяют дубликаты через `compareTo`, а не через `equals`.

Хрестоматийный пример — `BigDecimal`: `1.0` и `1.00` различаются по `equals`
(разный масштаб), но равны по `compareTo`. В `HashSet` поместятся оба числа,
а в `TreeSet` — только одно. Если класс сознательно нарушает согласованность,
это стоит явно описать в javadoc, как сделано у `BigDecimal`.

`compareTo`, несогласованный с `equals`:
```java
BigDecimal one = new BigDecimal("1.0"), oneOO = new BigDecimal("1.00");
System.out.println("equals: " + one.equals(oneOO) + ", compareTo: " + one.compareTo(oneOO));
System.out.println("HashSet size: " + new HashSet<>(List.of(one, oneOO)).size()
        + ", TreeSet size: " + new TreeSet<>(List.of(one, oneOO)).size());
```
```
equals: false, compareTo: 0
HashSet size: 2, TreeSet size: 1
```
Одни и те же два числа — два элемента в `HashSet` и один в `TreeSet`:
`HashSet` определяет дубликаты через `equals`, `TreeSet` — через `compareTo`.

### Comparator

#### Внешний порядок
`Comparator<T>` — функциональный интерфейс с методом `int compare(T a, T b)`.
Он задаёт порядок снаружи класса, поэтому их может быть сколько угодно: по
имени, по зарплате, по дате найма. Он нужен и тогда, когда класс чужой и
изменить его нельзя, или когда у класса нет естественного порядка вовсе.

Контракт у `compare` тот же, что у `compareTo`: знак, антисимметричность,
транзитивность. Поскольку это функциональный интерфейс, компаратор обычно
записывают лямбдой или собирают из готовых фабрик, а не пишут отдельным
классом.

#### Фабрики и комбинаторы
С Java 8 компараторы собирают декларативно. `Comparator.comparing(keyExtractor)`
сравнивает по извлечённому ключу, `thenComparing(...)` добавляет следующий
критерий для равных по предыдущему, `reversed()` разворачивает порядок. Для
примитивных ключей есть `comparingInt`, `comparingLong`, `comparingDouble` —
они не упаковывают числа в обёртки на каждом сравнении.

Есть и готовые компараторы: `Comparator.naturalOrder()` и `reverseOrder()`, а
также `nullsFirst(...)` и `nullsLast(...)`, которые оборачивают компаратор и
определяют место `null`. Без них `null` в сортируемых данных приводит к
`NullPointerException`.

Естественный порядок и составной компаратор:
```java
record Employee(String name, String dept, int salary) implements Comparable<Employee> {
    @Override public int compareTo(Employee o) { return name.compareTo(o.name); } // естественный порядок — по имени
}
// main:
List<Employee> staff = new ArrayList<>(List.of(
    new Employee("Olga", "dev", 300),
    new Employee("Ivan", "ops", 200),
    new Employee("Anna", "dev", 300),
    new Employee("Petr", "dev", 250)));

Collections.sort(staff);
System.out.println("natural: " + staff.stream().map(Employee::name).toList());

staff.sort(Comparator.comparing(Employee::dept)
        .thenComparing(Employee::salary, Comparator.reverseOrder())
        .thenComparing(Employee::name));
System.out.println("dept, salary desc, name: " + staff.stream().map(e -> e.dept() + "/" + e.salary() + "/" + e.name()).toList());

staff.sort(Comparator.comparing(Employee::dept).thenComparing(Employee::name).reversed());
System.out.println("reversed() всей цепочки: " + staff.stream().map(e -> e.dept() + "/" + e.name()).toList());
```
```
natural: [Anna, Ivan, Olga, Petr]
dept, salary desc, name: [dev/300/Anna, dev/300/Olga, dev/250/Petr, ops/200/Ivan]
reversed() всей цепочки: [ops/Ivan, dev/Petr, dev/Olga, dev/Anna]
```
Во втором случае обратный порядок нужен только для зарплаты, поэтому он
передан вторым аргументом в `thenComparing`. В третьем `reversed()` стоит в
конце цепочки и разворачивает её целиком — и отдел, и имя, хотя часто
ожидают, что он развернёт только последний критерий.

#### Где используется
Компаратор принимают `Collections.sort(list, cmp)` и `List.sort(cmp)`,
`Arrays.sort(arr, cmp)`, `Stream.sorted(cmp)`, `Stream.max/min`,
конструкторы `TreeSet`, `TreeMap` и `PriorityQueue`. Сортировка объектов в
`List.sort` и `Arrays.sort` стабильна (TimSort): равные по компаратору
элементы сохраняют исходный относительный порядок. Поэтому несколько
последовательных сортировок по разным ключам дают тот же результат, что одна
сортировка с `thenComparing` в обратном порядке ключей.

## Частые вопросы на собеседовании

**Q: Чем Comparable отличается от Comparator?**
A: `Comparable` реализует сам класс, и он задаёт единственный естественный
порядок, который используют `TreeSet`, `TreeMap` и сортировки без
параметров. `Comparator` — внешний объект, порядков может быть сколько угодно,
и он работает с классами, которые нельзя изменить. В современном коде
компараторы собирают через `Comparator.comparing().thenComparing()`, а не
пишут вручную.

**Q: Почему нельзя писать компаратор как a - b?**
A: Из-за переполнения `int`: разность большого положительного и большого
отрицательного числа выходит за диапазон и меняет знак, и компаратор начинает
возвращать неверный порядок. Нужно использовать `Integer.compare(a, b)` или
`Comparator.comparingInt(...)`, которые сравнивают без арифметики.

**Q: Что значит «compareTo согласован с equals» и что будет, если нет?**
A: Согласованность означает, что `compareTo` возвращает ноль тогда и только
тогда, когда `equals` возвращает `true`. Если это не так, сортированные
коллекции ведут себя иначе, чем хеш-коллекции: `TreeSet` считает дубликатами
объекты, равные по `compareTo`. Пример — `BigDecimal("1.0")` и
`BigDecimal("1.00")`: в `HashSet` их два, в `TreeSet` — один.

**Q: Что произойдёт, если компаратор нарушает контракт?**
A: Поведение сортировки и сортированных коллекций становится
непредсказуемым: элементы теряются в `TreeMap`, порядок неверен. TimSort в
`List.sort` и `Arrays.sort` иногда обнаруживает противоречие и бросает
`IllegalArgumentException: Comparison method violates its general contract!`
— но только на определённых данных, обычно на списках больше 32 элементов.

## Ловушки и частые ошибки

#### reversed() разворачивает всю цепочку
`comparing(a).thenComparing(b).reversed()` разворачивает порядок по обоим
ключам, а не только по `b`. Чтобы развернуть только один критерий, его
компаратор передают вторым аргументом: `thenComparing(b, reverseOrder())`, или
разворачивают отдельно: `thenComparing(comparing(b).reversed())`.

#### Вычитание в compare
Запись `(a, b) -> a.getAge() - b.getAge()` работает на маленьких числах и
ломается на больших из-за переполнения. Для `long` и `double` она вообще
некорректна: результат надо привести к `int`, теряя знак, а `NaN` и `-0.0`
сравниваются неверно. Правильно — `Integer.compare`, `Long.compare`,
`Double.compare` или `comparingInt/Long/Double`.

Сравнение вычитанием ломается на больших числах:
```java
List<Integer> nums = new ArrayList<>(List.of(1, Integer.MIN_VALUE, -1, Integer.MAX_VALUE));
nums.sort((a, b) -> a - b);
System.out.println("a - b:           " + nums);
nums.sort(Integer::compare);
System.out.println("Integer.compare: " + nums);
```
```
a - b:           [1, 2147483647, -2147483648, -1]
Integer.compare: [-2147483648, -1, 1, 2147483647]
```
`Integer.MAX_VALUE - (-1)` переполняется и становится отрицательным, поэтому
компаратор считает максимум меньше минус единицы. Результат даже не
упорядочен. `Integer.compare` (и `comparingInt`) сравнивают без вычитания.

#### null в сортируемых данных
`naturalOrder()` и большинство компараторов на ключах не обрабатывают `null`
и падают с `NullPointerException` посреди сортировки. Если `null` возможен,
место для него задают явно через `nullsFirst` или `nullsLast` — в том числе
для ключа: `comparing(Employee::manager, nullsLast(naturalOrder()))`.
```java
List<String> withNull = new ArrayList<>(Arrays.asList("b", null, "a"));
withNull.sort(Comparator.nullsFirst(Comparator.naturalOrder()));
System.out.println("nullsFirst: " + withNull);
withNull.sort(Comparator.naturalOrder()); // перехвачено
```
```
nullsFirst: [null, a, b]
naturalOrder с null -> NullPointerException
```
С `nullsFirst` сортировка прошла, а голый `naturalOrder()` упал, как только
дошёл до сравнения с `null`.

#### Изменение ключа объекта внутри TreeSet
Как и с `hashCode` в `HashSet`, изменение поля, по которому сравнивает
`TreeSet` или `TreeMap`, после добавления ломает структуру дерева. Объект
оказывается не на своём месте, и `contains`/`remove` перестают его находить.
Ключи сортированных коллекций должны быть неизменяемыми.

## Связанные темы
- [Массивы](../02-java-core/04-arrays.md) — Arrays.sort: TimSort для объектов и его стабильность.
- [Класс Object](06-object-class.md) — контракт equals, с которым желательно согласовать compareTo.
- [Set: HashSet, LinkedHashSet, TreeSet](../05-collections/03-set-implementations.md) — как TreeSet использует compareTo вместо equals.
- Стандартные функциональные интерфейсы (раздел 7) — Comparator как функциональный интерфейс.
- Stream API (раздел 7) — sorted, max, min с компаратором.

## Источники
- Joshua Bloch, «Effective Java», 3rd ed.: Item 14 «Consider implementing Comparable».
- [javadoc java.lang.Comparable](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Comparable.html), [java.util.Comparator](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Comparator.html).
