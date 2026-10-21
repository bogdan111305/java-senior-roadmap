---
title: "Optional"
section: 7
section_title: "Функциональный стиль и Stream API (Java 8+)"
topic_slug: "07-06-optional"
roadmap_ref: "Раздел 7 → Optional"
status: not-started
tags: [optional, null-safety, api-design, antipatterns]
related:
  - "07-03-stream-api"
  - "07-01-lambdas-and-closures"
  - "02-02-variables-and-types"
  - "17-02-entity-mapping"
last_reviewed: null
---

`Optional<T>` (Java 8) — контейнер, который либо содержит значение, либо пуст.
Его задача — показать в сигнатуре метода, что результата может не быть, и
заставить вызывающий код обработать этот случай. На собеседовании спрашивают не
API, а умение пользоваться им правильно: разницу `orElse` и `orElseGet` и типичные
злоупотребления — `Optional` в полях, параметрах и вместо пустых коллекций.

## Ключевые концепции

### Назначение и API

#### Возможное отсутствие значения в типе
Метод `User findUser(id)` ничего не говорит о том, может ли вернуться `null`, —
об этом знает только документация или опыт. `Optional<User> findUser(id)` делает
отсутствие результата частью типа: вызывающий код не сможет использовать
пользователя, не решив, что делать с пустым случаем. Так спроектированы
`Stream.findFirst`, `max`, `Optional.ofNullable` в Spring Data `findById`.

`Optional.of(value)` требует ненулевое значение и бросает
`NullPointerException` на `null`. `Optional.ofNullable(value)` превращает `null` в
пустой `Optional`, `Optional.empty()` создаёт пустой явно. Внутри `Optional`
никогда не бывает `null`.

```java
Optional.of(null);   // перехвачено
System.out.println("Optional.ofNullable(null): " + Optional.ofNullable(null));
```
```
Optional.of(null): NullPointerException
Optional.ofNullable(null): Optional.empty
```
`of` — для значения, которое точно есть, `ofNullable` — на границе с кодом,
возвращающим `null`.

#### orElse, orElseGet, orElseThrow
Три способа достать значение отличаются тем, что происходит с пустым случаем.
`orElse(default)` возвращает запасное значение, но сам аргумент вычисляется
всегда — даже если значение присутствует. `orElseGet(supplier)` вычисляет запасное
значение лениво, только при пустом `Optional`. `orElseThrow()` бросает
`NoSuchElementException`, а `orElseThrow(supplier)` — своё исключение.

Разница между `orElse` и `orElseGet` важна, когда запасное значение дорогое или
с побочным эффектом: запрос в базу, создание объекта, запись в лог.
`orElse(createDefaultUser())` создаст пользователя при каждом вызове, даже когда
он не нужен.

```java
static String expensiveDefault() {
    System.out.println("  вычисляем значение по умолчанию");
    return "default";
}
// ...
Optional<String> present = Optional.of("value");
System.out.println("orElse:    " + present.orElse(expensiveDefault()));
System.out.println("orElseGet: " + present.orElseGet(Opt::expensiveDefault));
Optional.empty().orElseThrow();                                                    // перехвачено
findUser(42).orElseThrow(() -> new IllegalArgumentException("пользователь 42 не найден"));   // перехвачено
```
```
  вычисляем значение по умолчанию
orElse:    value
orElseGet: value
orElseThrow(): No value present
orElseThrow(supplier): пользователь 42 не найден
```
Значение было, но `orElse` всё равно вызвал `expensiveDefault()`: аргумент
метода вычисляется до вызова. `orElseGet` к поставщику не обратился.

#### map, flatMap, filter, ifPresent
`Optional` поддерживает цепочки, как маленький стрим из нуля или одного элемента.
`map` преобразует значение, если оно есть, и превращает результат-`null` в пустой
`Optional`. `flatMap` — для функций, которые сами возвращают `Optional`, чтобы не
получить `Optional<Optional<T>>`. `filter` оставляет значение, только если оно
проходит условие.

Для действий есть `ifPresent(consumer)` и `ifPresentOrElse(consumer, runnable)`
(Java 9). Ещё в Java 9 добавили `or(supplier)` — запасной `Optional` — и `stream()`,
превращающий `Optional` в поток из нуля или одного элемента: так из потока
`Optional` удобно отбросить пустые.

```java
record User(String name, String email) {}
static final Map<Integer, User> DB = Map.of(1, new User("Аня", "anna@example.com"), 2, new User("Боб", null));
static Optional<User> findUser(int id) { return Optional.ofNullable(DB.get(id)); }
// ...
for (int id : new int[]{1, 2, 3}) {
    String domain = findUser(id)
            .map(User::email)                       // null внутри map -> пустой Optional
            .filter(e -> e.contains("@"))
            .map(e -> e.substring(e.indexOf('@') + 1))
            .orElse("нет почты");
    System.out.println("id=" + id + " -> " + domain);
}
Optional<Optional<String>> nested = findUser(1).map(u -> Optional.of(u.name()));
Optional<String> flat = findUser(1).flatMap(u -> Optional.of(u.name()));
System.out.println("map даёт " + nested + ", flatMap даёт " + flat);
```
```
id=1 -> example.com
id=2 -> нет почты
id=3 -> нет почты
map даёт Optional[Optional[Аня]], flatMap даёт Optional[Аня]
```
Пользователя 2 нет почты, пользователя 3 нет вовсе, но цепочка обработала оба
случая без единой проверки на `null`.

```java
findUser(1).ifPresentOrElse(u -> System.out.println("найден " + u.name()), () -> System.out.println("не найден"));
findUser(3).ifPresentOrElse(u -> System.out.println("найден " + u.name()), () -> System.out.println("не найден"));
System.out.println("or: " + findUser(3).or(() -> findUser(2)).map(User::name).orElse("-"));
List<String> names = List.of(1, 3, 2).stream().map(Opt::findUser).flatMap(Optional::stream).map(User::name).toList();
System.out.println("Optional::stream отбрасывает пустые: " + names);
```
```
найден Аня
не найден
or: Боб
Optional::stream отбрасывает пустые: [Аня, Боб]
```
`or` подставил второй поиск, когда первый ничего не нашёл, а
`flatMap(Optional::stream)` убрал из потока несуществующего пользователя 3.

### Антипаттерны

#### Optional как поле класса или параметр метода
`Optional` задуман для возвращаемых значений. Как поле он лишний: поле и так
может быть `null` внутри класса, где это контролируется, а `Optional` добавляет
объект на каждое поле. Кроме того, `Optional` не реализует `Serializable` —
сущность с таким полем не сериализуется стандартными средствами, а JPA его не
маппит.

Как параметр метода `Optional` неудобен вызывающему: вместо значения нужно
оборачивать, а `null` всё равно можно передать вместо самого `Optional`. Для
необязательных параметров используют перегрузку, `null` с документацией или
объект-параметр с builder.

```java
try (ObjectOutputStream out = new ObjectOutputStream(new ByteArrayOutputStream())) {
    out.writeObject(Optional.of("x"));
}   // NotSerializableException перехвачено
```
```
writeObject(Optional): NotSerializableException java.util.Optional
```
Поле типа `Optional` ломает сериализацию всего объекта. Если нужен
«необязательный» геттер, поле хранят как обычное, а `Optional` возвращают из
метода: `Optional<String> email() { return Optional.ofNullable(email); }`.

#### get() без проверки
`optional.get()` на пустом `Optional` бросает `NoSuchElementException` — это та
же ошибка, что `NullPointerException`, только с другим именем. Связка
`if (opt.isPresent()) { opt.get() ... }` формально безопасна, но возвращает к
стилю проверок на `null`, от которого `Optional` должен избавлять. Вместо неё —
`map`, `orElse*`, `ifPresent`.

```java
Optional.empty().get();   // перехвачено
```
```
get(): No value present
```
С Java 10 рекомендуют `orElseThrow()` без аргументов — тот же результат, но
название честно говорит, что метод может бросить исключение.

#### Optional вместо пустой коллекции
Метод, возвращающий коллекцию, при отсутствии результатов возвращает пустую
коллекцию, а не `Optional<List<T>>` и не `null`. Пустой список уже выражает
«ничего не найдено», а `Optional` добавляет лишний уровень проверки:
«`Optional` пуст» и «список пуст» становятся двумя разными состояниями без
разницы по смыслу.

## Частые вопросы на собеседовании

**Q: Чем orElse отличается от orElseGet?**
A: Аргумент `orElse` вычисляется всегда, до вызова метода, даже если значение
есть. `orElseGet` принимает `Supplier` и вызывает его только для пустого
`Optional`. Если запасное значение дорогое или имеет побочный эффект — запрос в
базу, создание объекта, — нужен `orElseGet`.

**Q: Для чего нужен Optional и где его не стоит использовать?**
A: Чтобы явно показать в возвращаемом типе, что результата может не быть, и
заставить вызывающий код обработать этот случай. Не стоит использовать его как
поле класса (лишний объект, не `Serializable`, не маппится JPA), как параметр
метода и вместо пустой коллекции. Для примитивов есть `OptionalInt`,
`OptionalLong`, `OptionalDouble`.

**Q: Чем map отличается от flatMap у Optional?**
A: `map` применяет функцию к значению и заворачивает результат в `Optional`; если
функция вернула `null`, получится пустой `Optional`. `flatMap` нужен для функции,
которая сама возвращает `Optional`, — иначе получится `Optional<Optional<T>>`.

**Q: Можно ли сравнивать Optional через ==?**
A: Нет: `Optional` — value-based класс, его идентичность не гарантирована, и
`==` может работать случайно (например, `Optional.empty()` — синглтон в текущей
реализации). Сравнивают через `equals`, который сравнивает содержимое.

## Ловушки и частые ошибки

#### Optional, который сам равен null
Метод с типом `Optional<T>`, возвращающий `null`, хуже, чем вовсе без `Optional`:
вызывающий код уверен, что `null` не будет, и падает на первом `.map`. Метод,
объявивший `Optional`, всегда возвращает `Optional.empty()` для пустого случая.

#### Optional в горячем цикле
Каждый `Optional` — объект. Цепочка `Optional.ofNullable(x).map(...).orElse(...)` в
цикле на миллионы итераций создаёт мусор там, где хватило бы проверки на `null`.
JIT часто убирает такие объекты, но на критичном по производительности коде
`Optional` используют на границах API, а не внутри алгоритмов.

#### Сравнение через ==
`Optional.of("a") == Optional.of("a")` — `false`, а `Optional.empty() ==
Optional.empty()` сейчас `true`, потому что пустой `Optional` — синглтон. Такой
код зависит от деталей реализации; содержимое сравнивают через `equals`.
```java
System.out.println("Optional.of(\"a\").equals(Optional.of(\"a\")): " + Optional.of("a").equals(Optional.of("a"))
        + ", empty() == empty(): " + (Optional.empty() == Optional.empty()));
OptionalInt max = IntStream.of(3, 8, 5).max();
System.out.println("IntStream.max(): " + max + ", пустой: " + IntStream.empty().max());
```
```
Optional.of("a").equals(Optional.of("a")): true, empty() == empty(): true
IntStream.max(): OptionalInt[8], пустой: OptionalInt.empty
```
Для примитивных стримов результат — `OptionalInt` без упаковки значения в
`Integer`.

## Связанные темы
- [Stream API](03-stream-api.md) — `findFirst`, `max`, `reduce` и `flatMap(Optional::stream)`.
- [Лямбда-выражения и замыкания](01-lambdas-and-closures.md) — ссылка на метод в `orElseGet` и момент вычисления.
- [Переменные и типы данных](../02-java-core/02-variables-and-types.md) — `null` и `NullPointerException` при распаковке.
- Маппинг сущностей и ключей (раздел 17) — почему поля сущностей не делают `Optional`.

## Источники
- [javadoc java.util.Optional](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Optional.html) — «API Note» о назначении `Optional` для возвращаемых значений.
- Stuart Marks, доклад «Optional — The Mother of All Bikesheds» (Devoxx 2016) — правила использования от автора из команды JDK.
- Joshua Bloch, «Effective Java», 3rd ed.: Item 55 «Return optionals judiciously», Item 54 «Return empty collections or arrays, not nulls».
