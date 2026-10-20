---
title: "Enum и аннотации"
section: 2
section_title: "Java Core: синтаксис и базовые конструкции"
topic_slug: "02-12-enum-and-annotations"
roadmap_ref: "Раздел 2 → Enum и аннотации"
status: not-started
tags: [enum, annotations, reflection, enumset]
related:
  - "02-09-classes-and-objects"
  - "02-12-01-enum-internals"
  - "09-09-reflection-api"
  - "03-04-abstract-vs-interface"
  - "17-02-entity-mapping"
last_reviewed: null
---

Enum в Java — не именованный набор чисел, как в C, а полноценный класс со
своими полями, конструктором и методами. Аннотации — метаданные, которые
компилятор, инструменты сборки и рантайм читают и обрабатывают. Обе темы
кажутся синтаксическим сахаром, но на собеседовании спрашивают и устройство
enum, и то, почему аннотация сама по себе ничего не делает.

## Ключевые концепции

### Enum

#### enum — это класс
`enum` объявляет тип с фиксированным набором экземпляров, перечисленных прямо в
объявлении: создать новый экземпляр снаружи нельзя ни через `new`, ни через
рефлексию. При этом enum — класс: у него могут быть поля, конструктор (всегда
`private` по смыслу) и методы, а каждая константа — заранее созданный объект.

Enum может реализовывать интерфейсы, но не может наследовать другой класс:
место родителя занято `java.lang.Enum`. Константа может иметь собственное тело
и переопределять методы — так реализуют паттерн «стратегия» прямо в enum. Как
всё это устроено в байткоде, разобрано в файле «Enum под капотом» этой темы.

#### values(), valueOf(), ordinal(), name()
У каждого enum автоматически есть несколько методов. `values()` возвращает
массив констант в порядке объявления. `valueOf(String)` возвращает константу по
точному имени, а для несуществующего — бросает `IllegalArgumentException`.

`ordinal()` — порядковый номер константы с нуля, `name()` — её имя в точности
как в исходнике. В отличие от `toString()`, который можно переопределить ради
красивого вывода, `name()` `final` и всегда возвращает настоящее имя.

#### Конструктор enum и статические поля
Константы enum создаются в его статическом инициализаторе первыми — раньше,
чем остальные статические поля. Поэтому конструктор enum не может обращаться к
статическим полям, кроме констант времени компиляции: компилятор сообщает
`illegal reference to static field from initializer`.

Типичный случай — желание зарегистрировать константу в статической `Map` прямо
из конструктора. Правильный способ — заполнить `Map` в `static`-блоке после
объявления констант, перебрав `values()`.

#### EnumMap и EnumSet
Для коллекций с enum-ключами есть специализированные структуры, заметно
эффективнее `HashMap` и `HashSet`. `EnumMap` хранит значения в массиве,
индексированном по `ordinal()`: доступ без вычисления хеша, а итерация всегда
идёт в порядке объявления констант.

`EnumSet` — битовый вектор: для enum до 64 констант это один `long`
(`RegularEnumSet`), для больших — массив `long` (`JumboEnumSet`). Объединение,
пересечение и дополнение (`complementOf`) сводятся к битовым операциям.
`EnumSet` — идиоматичная замена битовых флагов вида `int flags = READ | WRITE`.

#### Enum в switch и в базе данных
`switch` по enum работает по `ordinal()` через таблицу переходов, а switch
expression по enum проверяет исчерпываемость: если обработаны все константы,
`default` не нужен. Добавление новой константы ломает компиляцию таких
`switch`, напоминая обработать новый случай.

Сохранять enum во внешних системах по `ordinal()` опасно: перестановка констант
меняет номера. В JPA для этого используют `@Enumerated(EnumType.STRING)`
(раздел 17), а для явных кодов — отдельное поле с кодом и `AttributeConverter`.

### Аннотации

#### Что такое аннотация
Аннотация — метаданные, прикреплённые к элементу кода: классу, методу, полю,
параметру, а с Java 8 и к использованию типа. Сами по себе они поведение не
меняют — их читает компилятор, annotation processor или код через
рефлексию.

Из встроенных чаще всего встречаются четыре. `@Override` просит компилятор
проверить, что метод действительно переопределяет родительский — без неё
опечатка в сигнатуре создала бы новый метод. `@Deprecated` (с параметрами
`since` и `forRemoval`) помечает устаревший элемент. `@FunctionalInterface`
проверяет, что в интерфейсе ровно один абстрактный метод, а
`@SuppressWarnings` отключает конкретные предупреждения компилятора.

#### Мета-аннотации
Поведение аннотации задают мета-аннотации — аннотации на её объявлении.
`@Retention` определяет, как долго она живёт: `SOURCE` — только в исходнике
(как `@Override`), `CLASS` — в `.class`-файле, но недоступна рефлексии (значение
по умолчанию), `RUNTIME` — доступна через рефлексию во время работы.

`@Target` ограничивает, к чему аннотацию можно применить: `TYPE`, `METHOD`,
`FIELD`, `PARAMETER`, `TYPE_USE` и так далее. `@Documented` включает её в
javadoc, `@Repeatable` позволяет ставить её на один элемент несколько раз.
`@Inherited` делает аннотацию класса видимой у подклассов — но только при
наследовании классов: от интерфейсов и на методах она не наследуется.

#### Своя аннотация
Объявление аннотации похоже на интерфейс: `@interface Todo { String value();
String author() default "unknown"; }`. Методы без тела задают элементы, а
`default` — значение по умолчанию. Элемент с именем `value` можно указывать без
имени: `@Todo("написать тесты")`.

Типы элементов ограничены: примитивы, `String`, `Class`, enum, другие аннотации
и одномерные массивы из этих типов. `Object`, коллекции или произвольные
классы в аннотации положить нельзя, а значения должны быть константами
времени компиляции.

#### Обработка: рефлексия или annotation processor
Есть два принципиально разных способа обработать аннотацию. Рефлексия в
рантайме: код вызывает `getAnnotation`/`isAnnotationPresent` и действует по
результату — так работают Spring, Hibernate и JUnit. Это требует
`RetentionPolicy.RUNTIME`.

Annotation processor подключается к компилятору и обрабатывает аннотации при
компиляции, в том числе с `SOURCE`. Он может проверять код и генерировать новые
исходники — так работают MapStruct, Dagger и `jpamodelgen`. Lombok идёт дальше
и через внутренние API компилятора меняет уже существующие классы.

## Примеры

Enum с полями, конструктором и методом:
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
Каждая константа — заранее созданный объект со своими значениями полей.

`EnumMap` и `EnumSet`:
```java
enum Day { MON, TUE, WED, THU, FRI, SAT, SUN }

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
Элементы добавлялись в порядке `WED, MON, FRI`, а `EnumMap` вывел их в порядке
`ordinal`.

Своя аннотация и рефлексия:
```java
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
@interface Todo {
    String value();
    String author() default "unknown";
}

@Todo(value = "написать тесты", author = "Isla")
@Deprecated
public void legacyMethod() {}

// Method m = ...getMethod("legacyMethod");
// Todo todo = m.getAnnotation(Todo.class);
// System.out.println("value=" + todo.value() + " author=" + todo.author());
```
```
value=написать тесты author=Isla
isAnnotationPresent(Deprecated): true
```

`@Repeatable`, границы `@Inherited` и реализации `EnumSet`:
```java
@Retention(RetentionPolicy.RUNTIME) @Repeatable(Roles.class) @interface Role { String value(); }
@Retention(RetentionPolicy.RUNTIME) @interface Roles { Role[] value(); }

@Role("admin") @Role("auditor")
static class Service {}

@Retention(RetentionPolicy.RUNTIME) @Inherited @interface Tracked {}
@Tracked static class Base {}
static class Child extends Base {}
@Tracked interface Api {}
static class Impl implements Api {}

enum Small { A, B }
// enum Big — 70 констант
// main:
System.out.println("@Repeatable: " + Arrays.toString(Service.class.getAnnotationsByType(Role.class)));
System.out.println("@Inherited — от класса: " + Child.class.isAnnotationPresent(Tracked.class)
        + ", от интерфейса: " + Impl.class.isAnnotationPresent(Tracked.class));
System.out.println("EnumSet для 2 констант: " + EnumSet.noneOf(Small.class).getClass().getSimpleName()
        + ", для 70 констант: " + EnumSet.noneOf(Big.class).getClass().getSimpleName());
```
```
@Repeatable: [@Ann.Role("admin"), @Ann.Role("auditor")]
@Inherited — от класса: true, от интерфейса: false
EnumSet для 2 констант: RegularEnumSet, для 70 констант: JumboEnumSet
```
Повторяющаяся аннотация хранится внутри контейнера `Roles`, а
`getAnnotationsByType` достаёт её экземпляры. Аннотация с `@Inherited` перешла
от родительского класса, но не от интерфейса.

Ошибки, которые ловит компилятор:
```java
enum Color {
    RED, GREEN;
    private static final Map<String, Color> BY_NAME = new HashMap<>();
    Color() {
        BY_NAME.put(name(), this);   // статическое поле ещё не инициализировано
    }
}

@interface Bad {
    Object value();                  // недопустимый тип элемента аннотации
}
```
```
EnumFail.java:10: error: illegal reference to static field from initializer
        BY_NAME.put(name(), this);
        ^
EnumFail.java:15: error: invalid type for annotation interface element
    Object value();
    ^
2 errors
```

## Частые вопросы на собеседовании

**Q: Почему enum считается надёжным способом реализовать singleton?**
A: Экземпляр константы создаётся один раз при инициализации класса, что
потокобезопасно само по себе. Рефлексия не может вызвать конструктор enum, а
сериализация восстанавливает константу по имени, возвращая существующий
объект. Эти гарантии даёт платформа, а не дисциплина разработчика (подробнее —
в «Enum под капотом»).

**Q: В чём разница между @Retention(SOURCE), CLASS и RUNTIME?**
A: `SOURCE` — аннотация видна только компилятору и не попадает в `.class`
(`@Override`). `CLASS` — есть в байткоде, но не доступна рефлексии; это
значение по умолчанию. `RUNTIME` — доступна через рефлексию во время работы, и
именно она нужна фреймворкам вроде Spring и Hibernate.

**Q: Почему конструктор enum не может обратиться к статическому полю?**
A: Константы создаются в статическом инициализаторе первыми, до
инициализации остальных статических полей. Конструктор увидел бы поле в
значении по умолчанию, поэтому компилятор это запрещает. Регистрацию констант
в статической `Map` делают в `static`-блоке после объявления констант.

**Q: Как работает @Inherited?**
A: Аннотация с `@Inherited`, поставленная на класс, видна через
`getAnnotation` и у его подклассов. На интерфейсы и методы это не
распространяется: класс, реализующий аннотированный интерфейс, аннотацию не
получает. Поэтому фреймворки вроде Spring сами обходят иерархию, чтобы найти
аннотации на интерфейсах и мета-аннотации.

## Ловушки и частые ошибки

#### equals() вместо == для enum
Enum-константа — единственный экземпляр на загрузчик классов, поэтому `==` для
enum корректен и идиоматичен. Он быстрее и не бросает `NullPointerException`,
если слева `null`, в отличие от `equals()`.

#### Аннотация сама по себе ничего не делает
Аннотация — только метаданные. Поведение обеспечивает инструмент, который её
читает: рефлексия в рантайме или annotation processor при компиляции. Если
никто её не читает, код с аннотацией ведёт себя как без неё.

#### Забытый @Retention(RUNTIME)
Retention по умолчанию — `CLASS`, и такая аннотация не видна через рефлексию:
`getAnnotation` вернёт `null`. Это частая причина того, что «самописная
аннотация не работает».

#### Хранение enum по ordinal
Перестановка или вставка константы в середину меняет `ordinal()` у остальных,
и данные в базе, кэше или сериализованных файлах начинают указывать не на те
константы. Храните `name()` или явный код.

## Материалы для углублённого изучения
- [Enum под капотом](01-enum-internals.md) — как enum компилируется в класс, наследующий `java.lang.Enum`, почему это надёжный singleton и как устроены константы с телом и `switch` по enum.

## Связанные темы
- [Классы и объекты](../09-classes-and-objects.md) — конструкторы и модификаторы доступа, на которых построен enum.
- [Абстракция: abstract class vs interface](../../03-oop/04-abstract-vs-interface.md) — почему enum реализует интерфейсы, но не наследует класс.
- Reflection API (раздел 9) — чтение аннотаций с `RetentionPolicy.RUNTIME`.
- Маппинг сущностей и ключей (раздел 17) — `@Enumerated` и `AttributeConverter`.

## Источники
- [JLS §8.9: Enum Classes](https://docs.oracle.com/javase/specs/jls/se21/html/jls-8.html#jls-8.9), [§9.6: Annotation Interfaces](https://docs.oracle.com/javase/specs/jls/se21/html/jls-9.html#jls-9.6).
- [javadoc java.util.EnumSet](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/EnumSet.html).
- Joshua Bloch, «Effective Java», 3rd ed.: Item 34 «Use enums instead of int constants», Item 35 «Use instance fields instead of ordinals», Item 36 «Use EnumSet instead of bit fields», Item 39 «Prefer annotations to naming patterns».
