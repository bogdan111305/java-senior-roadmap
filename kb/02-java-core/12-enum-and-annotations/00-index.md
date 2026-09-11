---
title: "Enum и аннотации"
section: 2
section_title: "Java Core: синтаксис и базовые конструкции"
topic_slug: "02-12-enum-and-annotations"
roadmap_ref: "Раздел 2 → Enum и аннотации"
status: not-started
tags: [enum, annotations, reflection]
related:
  - "02-09-classes-and-objects"
  - "09-09-reflection-api"
  - "03-04-abstract-vs-interface"
last_reviewed: null
---

Enum в Java — не просто именованный набор констант, как в C, а полноценный
класс со своими полями, конструктором и методами; аннотации — метаданные,
которые компилятор и рантайм могут читать и обрабатывать программно. Обе темы
кажутся синтаксическим сахаром на первый взгляд, но на senior-собеседовании
именно устройство enum «под капотом» — один из показательных вопросов,
выносящий разговор за пределы «я знаю, как это писать».

## Ключевые концепции

### Enum

#### enum — это класс, а не просто набор констант
`enum` объявляет тип с фиксированным, заранее известным набором экземпляров —
и это ключевое отличие от обычного класса: список возможных значений
исчерпывающе задан прямо в объявлении и не может быть расширен извне во время
выполнения. При этом сам по себе enum — не примитивная языковая конструкция, а
именно класс: он может иметь собственные поля, конструктор (обязательно
`private` или package-private — создавать новые экземпляры извне запрещено
языком) и обычные методы, точно так же, как любой другой класс. Устройство
этого механизма на уровне байткода — то, что enum на самом деле компилируется
в класс, неявно наследующий `java.lang.Enum` — разобрано подробно в отдельном
файле «Enum под капотом» этой темы (ссылка внизу), здесь же — практический
минимум, достаточный для повседневного использования и для базового уровня
собеседования.

```java
enum Planet {
    MERCURY(3.303e+23, 2.4397e6),
    VENUS(4.869e+24, 6.0518e6),
    EARTH(5.976e+24, 6.37814e6);

    private final double mass;
    private final double radius;

    Planet(double mass, double radius) {
        this.mass = mass;
        this.radius = radius;
    }

    double surfaceGravity() {
        final double G = 6.67300E-11;
        return G * mass / (radius * radius);
    }
}
// for (Planet p : Planet.values()) {
//     System.out.printf("%s: ordinal=%d gravity=%.2f%n", p.name(), p.ordinal(), p.surfaceGravity());
// }
```
```
MERCURY: ordinal=0 gravity=3.70
VENUS: ordinal=1 gravity=8.87
EARTH: ordinal=2 gravity=9.80
```
Каждая константа несёт собственные значения `mass`/`radius`, переданные через
конструктор при объявлении, — enum-константа здесь ведёт себя как полноценный
заранее сконструированный объект своего класса, а не просто как именованное
целое число.

#### values(), valueOf(), ordinal(), name()
У любого enum-типа автоматически появляются несколько методов, которые не
нужно объявлять вручную. `values()` возвращает массив всех констант в порядке
их объявления в исходном коде — удобно для перебора всех возможных значений в
цикле. `valueOf(String)` — статический метод, который по точному текстовому
имени константы (совпадающему с тем, как она написана в объявлении enum)
возвращает соответствующий экземпляр, а для несуществующего имени бросает
`IllegalArgumentException`. `ordinal()` — порядковый номер константы в
порядке объявления, начиная с нуля; `name()` — её имя строкой, в точности как
оно написано в исходном коде enum (в отличие от переопределяемого `toString()`,
`name()` всегда возвращает «настоящее» имя константы и не может быть изменён).

```java
enum Day { MON, TUE, WED, THU, FRI, SAT, SUN }

for (Day d : Day.values()) {
    System.out.println(d.name() + " ordinal=" + d.ordinal());
}

Day parsed = Day.valueOf("WED");
System.out.println("valueOf(\"WED\") = " + parsed);

try {
    Day.valueOf("Wednesday");
} catch (IllegalArgumentException e) {
    System.out.println("valueOf(\"Wednesday\") -> IllegalArgumentException");
}
```
```
MON ordinal=0
TUE ordinal=1
WED ordinal=2
THU ordinal=3
FRI ordinal=4
SAT ordinal=5
SUN ordinal=6
valueOf("WED") = WED
valueOf("Wednesday") -> IllegalArgumentException
```
`values()` перебирает все константы в порядке объявления, `name()`/`ordinal()`
дают имя и позицию каждой. `valueOf` требует точного совпадения имени
константы — `"Wednesday"` не совпадает с `"WED"` посимвольно, и вместо
подбора ближайшего совпадения метод сразу бросает `IllegalArgumentException`.

#### EnumMap и EnumSet
Для коллекций, ключами или элементами которых выступают именно enum-константы,
стандартная библиотека предлагает специализированные структуры, заметно
эффективнее универсальных `HashMap`/`HashSet`. `EnumMap<K, V>` внутри хранит
значения в обычном массиве, индексированном по `ordinal()` соответствующей
константы, — поэтому обращение к элементу происходит без вычисления хеша и
разрешения коллизий, и итерация по `EnumMap` всегда идёт в порядке объявления
констант (по возрастанию `ordinal`), а не в порядке вставки, как у `HashMap`.
`EnumSet` устроен похоже — как битовый вектор поверх той же идеи индексации по
`ordinal`, что делает операции над множеством enum-констант (объединение,
пересечение, дополнение через `complementOf`) значительно компактнее и быстрее,
чем эквивалентные операции над `HashSet<E>`.

```java
EnumMap<Day, String> schedule = new EnumMap<>(Day.class);
schedule.put(Day.WED, "код-ревью");
schedule.put(Day.MON, "планирование");
schedule.put(Day.FRI, "демо");
System.out.println("EnumMap: " + schedule);

EnumSet<Day> weekend = EnumSet.of(Day.SAT, Day.SUN);
System.out.println("weekdays (complementOf): " + EnumSet.complementOf(weekend));
```
```
EnumMap: {MON=планирование, WED=код-ревью, FRI=демо}
weekdays (complementOf): [MON, TUE, WED, THU, FRI]
```
Несмотря на то что элементы добавлялись в порядке `WED, MON, FRI`, `EnumMap`
вывел их в порядке `ordinal` (`MON, WED, FRI`) — прямое следствие того, что
внутри он хранит значения в массиве, индексированном по номеру константы, а не
в порядке вставки, как это было бы у `HashMap`.

### Аннотации

#### Что такое аннотация: @Override, @Deprecated, @FunctionalInterface, @SuppressWarnings
Аннотация — это метаданные, прикреплённые к элементу кода (классу, методу,
полю, параметру), которые сами по себе не меняют поведение программы
напрямую, но могут быть прочитаны и обработаны компилятором, инструментами
сборки или рантаймом через рефлексию. Из встроенных в язык аннотаций
регулярно встречаются четыре: `@Override` — просит компилятор проверить, что
помеченный метод действительно переопределяет метод родителя или реализует
метод интерфейса (без неё опечатка в сигнатуре создала бы не переопределение,
а новый, никак не связанный overloaded-метод, и компилятор бы это молча
пропустил); `@Deprecated` — помечает элемент устаревшим, давая компилятору
основание для предупреждения при его использовании (а с параметром
`forRemoval = true` — сигнализирует о планах полного удаления в будущем);
`@FunctionalInterface` — просит компилятор проверить, что интерфейс содержит
ровно один абстрактный метод, то есть пригоден для использования как цель
лямбда-выражения (раздел 7); `@SuppressWarnings` — просит компилятор не
выводить предупреждения конкретной категории (`"unchecked"`, `"deprecation"` и
так далее) для помеченного элемента.

```java
interface Greeter {
    void greet(String name);
}
class EnglishGreeter implements Greeter {
    @Override // компилятор проверяет, что это реализация Greeter.greet, а не новый метод
    public void greet(String name) {
        System.out.println("Hello, " + name);
    }
}
// вызов: new EnglishGreeter().greet("Isla");
```
```
Hello, Isla
```
`@Override` не меняет исполнение (программа вела бы себя так же и без неё),
но если бы сигнатура здесь отличалась от `Greeter.greet` — скажем, опечатка в
имени метода — компилятор упал бы на месте с явной ошибкой, вместо того чтобы
молча создать новый, никак не связанный с интерфейсом метод.

```java
@FunctionalInterface
interface OneMethod {
    void run();
    void runTwice(); // второй абстрактный метод нарушает контракт "ровно один"
}
```
```
OneMethod.java:2: error: Unexpected @FunctionalInterface annotation
@FunctionalInterface
^
  OneMethod is not a functional interface
  multiple non-overriding abstract methods found in interface OneMethod
1 error
```
`@FunctionalInterface` здесь реально ловит нарушение контракта уже на этапе
компиляции — без неё `OneMethod` с двумя абстрактными методами просто
перестал бы годиться как цель лямбда-выражения, и ошибка обнаружилась бы
только там, где кто-то попытался бы использовать `() -> ...` для этого
интерфейса, а не сразу в месте объявления.

#### Мета-аннотации: @Retention, @Target, @Inherited
Поведение любой аннотации, включая пользовательскую, определяют
мета-аннотации — аннотации, применяемые к самому объявлению аннотации.
`@Retention` задаёт, до какого этапа жизненного цикла кода аннотация вообще
сохраняется: `SOURCE` — видна только в исходном коде и полностью отбрасывается
уже на этапе компиляции (типичный пример — сам `@Override`, он нужен только
компилятору и бесполезен в скомпилированном байткоде); `CLASS` — попадает в
`.class`-файл, но не загружается в память JVM при выполнении (используется
редко, в основном инструментами байткод-анализа) и является значением по
умолчанию, если `@Retention` не указана явно; `RUNTIME` — сохраняется и в
байткоде, и доступна через рефлексию во время выполнения программы — именно
этот уровень нужен, если аннотацию планируется читать в рантайме (как делают
Spring, Hibernate, JUnit и большинство фреймворков вокруг DI, ORM и тестов).
`@Target` ограничивает, к каким именно элементам кода (`TYPE`, `METHOD`,
`FIELD`, `PARAMETER` и другие значения `ElementType`) вообще можно применить
эту аннотацию — попытка использовать её не по назначению не компилируется.
`@Inherited` — специфическая мета-аннотация, которая заставляет аннотацию,
применённую к классу, автоматически считаться присутствующей и у его
подклассов (по умолчанию аннотации классов не наследуются).

```java
@Inherited
@interface Auditable {}

@Auditable
class Base {}
class Derived extends Base {} // сам НЕ помечен @Auditable

System.out.println("Base помечен явно: " + Base.class.isAnnotationPresent(Auditable.class));
System.out.println("Derived видит Auditable благодаря @Inherited: " + Derived.class.isAnnotationPresent(Auditable.class));
```
```
Base помечен явно: true
Derived видит Auditable благодаря @Inherited: true
```
```java
@interface NotInherited {} // без @Inherited

@NotInherited
class Base2 {}
class Derived2 extends Base2 {}

System.out.println("Derived2 видит NotInherited: " + Derived2.class.isAnnotationPresent(NotInherited.class));
```
```
Derived2 видит NotInherited: false
```
Разница только в одной мета-аннотации на объявлении самой аннотации —
`@Inherited` у `Auditable` заставляет `isAnnotationPresent` вернуть `true` и
для `Derived`, который сам этой аннотацией нигде не помечен, а без
`@Inherited` (как у `NotInherited`) наследник её не видит вовсе, хотя базовый
класс помечен точно так же в обоих случаях.

#### Своя аннотация: рефлексия vs annotation processor
Создание собственной аннотации синтаксически похоже на объявление интерфейса
(`@interface Todo { ... }`), где методы без тела определяют параметры
аннотации, а `default` после сигнатуры задаёт значение по умолчанию, если
параметр не указан при использовании. Обработка пользовательских аннотаций
идёт одним из двух принципиально разных путей. Первый — через рефлексию в
рантайме: код явно запрашивает `element.getAnnotation(MyAnnotation.class)` и
читает её параметры программно (это работает только для аннотаций с
`RetentionPolicy.RUNTIME`). Второй — через annotation processor: отдельный
код, подключаемый к компилятору через Java Annotation Processing API (`javax.
annotation.processing`), который сканирует аннотации ещё на этапе компиляции
(работает и с `RetentionPolicy.SOURCE`) и может генерировать на их основе
дополнительный исходный код — на этом принципе построены, например, Lombok и
генерация кода в Dagger/MapStruct, где аннотации служат декларативным
описанием того, какой код нужно сгенерировать, вместо ручного написания
boilerplate.

```java
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
@interface Todo {
    String value();
    String author() default "unknown";
}

class LegacyService {
    @Todo(value = "написать тесты", author = "Isla")
    @Deprecated
    public void legacyMethod() {}
}

Method m = LegacyService.class.getMethod("legacyMethod");
Todo todo = m.getAnnotation(Todo.class);
System.out.println("value=" + todo.value() + " author=" + todo.author());
System.out.println("isAnnotationPresent(Deprecated): " + m.isAnnotationPresent(Deprecated.class));
```
```
value=написать тесты author=Isla
isAnnotationPresent(Deprecated): true
```
Аннотация с `RetentionPolicy.RUNTIME` доступна через рефлексию точно так же,
как и встроенный `@Deprecated`, — `getAnnotation`/`isAnnotationPresent` читают
их одинаково, потому что для JVM пользовательская и встроенная аннотация с
одинаковым `@Retention` не различаются механизмом хранения в байткоде.

## Частые вопросы на собеседовании

**Q: Чем values() из enum отличается от обычного метода, возвращающего коллекцию?**
A: `values()` — синтетический статический метод, добавляемый компилятором
автоматически, возвращающий массив всех констант в порядке их объявления в
исходном коде. Важная деталь (подробнее — в «Enum под капотом»): каждый вызов
возвращает клон внутреннего массива, а не сам этот массив напрямую, что
защищает исходные данные от порчи через возвращённый массив ценой небольшого,
но реального накладного расхода на каждый вызов в горячем коде.

**Q: В чём разница между @Retention(SOURCE), @Retention(CLASS) и @Retention(RUNTIME)?**
A: Это три разные точки, до которых аннотация «доживает». `SOURCE` — видна
только компилятору и полностью отсутствует в скомпилированном `.class`-файле
(пример — `@Override`). `CLASS` — попадает в байткод, но не загружается в
структуры JVM при выполнении программы, используется редко и является
значением по умолчанию. `RUNTIME` — доступна и в байткоде, и через рефлексию
во время исполнения — именно этот уровень обязателен, если аннотацию
планируется читать программно в рантайме, как это делают большинство
DI/ORM/тестовых фреймворков.

## Ловушки и частые ошибки

#### enum: == вместо equals()
Частая ошибка — сравнивать enum-константы через `equals()` вместо `==`,
считая это более «безопасным» способом, как это принято для `String`. Для
enum ровно наоборот: поскольку каждая константа — единственный на всю JVM
экземпляр (гарантируется самим механизмом enum, подробнее — в «Enum под
капотом»), `==` для enum-констант не только допустим, но и является
предпочтительным идиоматичным способом сравнения — он быстрее и, в отличие от
`equals()`, никогда не бросит `NullPointerException` на `null`-ссылке слева.

```java
enum Status { ACTIVE, INACTIVE }

Status a = Status.ACTIVE;
Status b = Status.valueOf("ACTIVE");
System.out.println("a == b: " + (a == b));
System.out.println("a.equals(b): " + a.equals(b));

Status nullStatus = null;
System.out.println("nullStatus == Status.ACTIVE: " + (nullStatus == Status.ACTIVE));
try {
    System.out.println(nullStatus.equals(Status.ACTIVE));
} catch (NullPointerException e) {
    System.out.println("nullStatus.equals(...) -> NullPointerException");
}
```
```
a == b: true
a.equals(b): true
nullStatus == Status.ACTIVE: false
nullStatus.equals(...) -> NullPointerException
```
`a` и `b` — буквально один и тот же объект (единственный экземпляр `ACTIVE` на
всю JVM), поэтому `==` и `equals` дают одинаковый результат `true`. Но на
`null`-ссылке разница критична: `==` спокойно возвращает `false`, а вызов
`equals` на `null` падает с `NullPointerException` ещё до того, как
сравнение вообще успело бы произойти.

#### Аннотация сама по себе ничего не делает
Другое заблуждение — полагать, что аннотация сама по себе что-то «делает» с
кодом просто по факту присутствия. Аннотация — чистые метаданные; любое
реальное поведение (валидация, генерация кода, DI) обеспечивает не сама
аннотация, а инструмент, который явно её читает — рефлексия в рантайме или
annotation processor на этапе компиляции. Код с аннотацией, которую никто не
читает ни одним из этих способов, ведёт себя абсолютно так же, как код без
неё вовсе.

#### Забытый @Retention — null из getAnnotation
Похожая ловушка — забывать указать подходящий `@Retention` для собственной
аннотации и удивляться, почему `getAnnotation(...)` в рантайме возвращает
`null`. Retention по умолчанию — `CLASS`, не `RUNTIME`, и аннотация с этим
(или тем более с `SOURCE`) retention просто не видна через обычную рефлексию —
это осознанная, но легко упускаемая деталь при написании своих аннотаций,
предназначенных для чтения в рантайме.

```java
@interface NoRetention {} // @Retention не указан явно -> по умолчанию CLASS, не RUNTIME

@NoRetention
class Marked {}

System.out.println("getAnnotation(NoRetention) в рантайме: " + Marked.class.getAnnotation(NoRetention.class));
```
```
getAnnotation(NoRetention) в рантайме: null
```
В отличие от `Todo` из примера выше (там `@Retention(RetentionPolicy.RUNTIME)`
указан явно), здесь аннотация физически присутствует в байткоде класса
`Marked` (retention по умолчанию `CLASS`), но не загружается в структуры,
доступные через рефлексию в рантайме, — `getAnnotation` честно возвращает
`null`, а не бросает исключение, что и делает эту ошибку особенно легко
пропустить.

## Материалы для углублённого изучения
- [Enum под капотом](01-enum-internals.md) — как компилятор превращает enum в класс, наследующий `java.lang.Enum`, почему это делает enum надёжным способом сделать singleton, и как устроены константы с собственным телом.

## Связанные темы
- [Классы и объекты](../09-classes-and-objects.md) — конструкторы и модификаторы доступа, на которые опирается устройство enum-класса.
- Reflection API (раздел 9) — механизм, которым в рантайме читаются аннотации с `RetentionPolicy.RUNTIME`.
- Abstract class vs interface (раздел 3) — почему enum может реализовывать интерфейсы, но не наследовать другой класс.
