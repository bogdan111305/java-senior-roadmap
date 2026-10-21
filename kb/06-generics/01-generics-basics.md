---
title: "Основы generics"
section: 6
section_title: "Generics (обобщённое программирование)"
topic_slug: "06-01-generics-basics"
roadmap_ref: "Раздел 6 → Основы generics"
status: not-started
tags: [generics, type-erasure, raw-types, type-inference, reflection]
related:
  - "06-02-bounded-types-and-wildcards"
  - "06-03-generics-pitfalls"
  - "05-01-collections-hierarchy"
  - "09-08-bytecode-and-invokedynamic"
  - "09-09-reflection-api"
last_reviewed: null
---

Generics (Java 5) переносят проверку типов коллекций и контейнеров из рантайма
на этап компиляции: `List<String>` не даст положить число, а при чтении не
нужно приведение. Главный вопрос senior-собеседования здесь — стирание типов:
что от `<String>` остаётся в байткоде, почему `List<String>` и `List<Integer>` в
рантайме — один класс и почему при этом фреймворки всё-таки умеют читать
параметры типов.

## Ключевые концепции

### Базовые понятия

#### Generic-классы и generic-методы
Generic-класс объявляет параметры типа в угловых скобках: `class Box<T>`,
`class Pair<K, V>`. Внутри класса `T` используется как обычный тип полей,
параметров и результатов, а при использовании подставляется конкретный тип:
`Box<String>`. До generics контейнеры хранили `Object`, и каждое чтение
требовало приведения, которое могло упасть в рантайме.

Generic-метод объявляет собственный параметр типа перед возвращаемым типом:
`static <T> T firstOrDefault(List<T> list, T def)`. Он может быть и в обычном
классе. Тип обычно выводится компилятором из аргументов и контекста (type
inference), а при необходимости указывается явно: `Util.<String>method(...)`.
Diamond `new Box<>(...)` (Java 7) выводит параметры конструктора из типа
переменной.

```java
static class Box<T> {
    private T value;
    Box(T value) { this.value = value; }
    T get() { return value; }
    <R> Box<R> map(Function<? super T, ? extends R> f) { return new Box<>(f.apply(value)); }
}
static <T> T firstOrDefault(List<T> list, T def) {
    return list.isEmpty() ? def : list.get(0);
}
static <T extends Comparable<T>> T maxOf(T a, T b) { return a.compareTo(b) >= 0 ? a : b; }
// ...
Box<String> box = new Box<>("hello");
String s = box.get();                    // без приведения
Box<Integer> len = box.map(String::length);
System.out.println("box=" + s + ", map(length)=" + len.get());
System.out.println("firstOrDefault(пустой, \"нет\"): " + firstOrDefault(new ArrayList<String>(), "нет"));
System.out.println("явный type witness: " + Basics.<String>firstOrDefault(List.of("a", "b"), "x"));
System.out.println("maxOf(3, 7)=" + maxOf(3, 7) + ", maxOf(\"pear\", \"apple\")=" + maxOf("pear", "apple"));
```
```
box=hello, map(length)=5
firstOrDefault(пустой, "нет"): нет
явный type witness: a
maxOf(3, 7)=7, maxOf("pear", "apple")=pear
```
`map` объявляет свой параметр `R` поверх параметра класса `T` и превращает
`Box<String>` в `Box<Integer>`. Один и тот же `maxOf` работает для чисел и строк:
тип выведен из аргументов, а граница `Comparable<T>` гарантирует наличие
`compareTo` (подробнее — в теме «Границы типов и wildcard»).

#### Type erasure: стирание типов
Generics в Java реализованы стиранием (type erasure): параметры типов
существуют только для компилятора. После проверки `javac` заменяет `T` на его
границу — `Object` или первый тип из `extends`, — а в местах использования
вставляет приведения. В рантайме `List<String>` и `List<Integer>` — один и тот
же класс `ArrayList`.

Такой дизайн выбрали ради совместимости: generics добавили в Java 5 так, что
старый байткод и старые библиотеки продолжили работать без перекомпиляции, а
JVM менять не пришлось. Цена — в рантайме нельзя узнать параметр типа объекта,
создать `new T()` или `new T[]` и различить перегрузки по параметру типа (тема
«Ограничения и подводные камни generics»).

```java
List<String> strings = new ArrayList<>();
List<Integer> ints = new ArrayList<>();
System.out.println("один класс в рантайме: " + (strings.getClass() == ints.getClass()) + " — " + strings.getClass().getName());
Method get = Box.class.getDeclaredMethod("get");
System.out.println("Box.get(): возвращаемый тип в байткоде=" + get.getReturnType().getName() + ", объявленный=" + get.getGenericReturnType());
Method max = Basics.class.getDeclaredMethod("maxOf", Comparable.class, Comparable.class);
System.out.println("maxOf после стирания: " + max.getReturnType().getName() + " maxOf(" + max.getParameterTypes()[0].getName() + ", ...)");
```
```
один класс в рантайме: true — java.util.ArrayList
Box.get(): возвращаемый тип в байткоде=java.lang.Object, объявленный=T
maxOf после стирания: java.lang.Comparable maxOf(java.lang.Comparable, ...)
```
`T` без границы стёрся до `Object`, а `T extends Comparable<T>` — до своей границы
`Comparable`. Поиск метода через рефлексию идёт именно по стёртым типам
параметров.

#### Raw types и совместимость с legacy-кодом
Raw type — generic-тип без аргументов: `List` вместо `List<String>`. Он оставлен
для совместимости с кодом до Java 5. Компилятор не может проверить операции с
raw-типом и лишь выдаёт предупреждения `unchecked` и `rawtypes` — а по
умолчанию даже их не показывает, только сводку «uses unchecked or unsafe
operations».

Опасность в том, что ошибка проявляется не там, где сделана. Через raw-ссылку в
`List<String>` можно положить число, и упадёт не запись, а чтение где-то в другом
месте программы. Такое состояние называют heap pollution — «загрязнение кучи»:
переменная параметризованного типа ссылается на объект, содержимое которого
этому типу не соответствует.

```java
List<String> safe = new ArrayList<>(List.of("a"));
List raw = safe;
raw.add(42);                              // компилятор лишь предупреждает
System.out.println("в List<String> лежит: " + safe);
String second = safe.get(1);              // перехвачено
```
```
в List<String> лежит: [a, 42]
чтение: class java.lang.Integer cannot be cast to class java.lang.String (java.lang.Integer and java.lang.String are in module java.base of loader 'bootstrap')
```
Список, объявленный как `List<String>`, содержит `Integer`. Исключение
возникло при чтении — в строке, которая сама по себе корректна.

Предупреждения, которые `javac` прячет по умолчанию, видны с `-Xlint`:
```java
List raw = new ArrayList();
raw.add("x");                    // unchecked call
List<String> typed = raw;        // unchecked conversion
```
```
$ javac RawWarn.java
Note: RawWarn.java uses unchecked or unsafe operations.
Note: Recompile with -Xlint:unchecked for details.

$ javac -Xlint:unchecked,rawtypes RawWarn.java
RawWarn.java:6: warning: [rawtypes] found raw type: List
RawWarn.java:6: warning: [rawtypes] found raw type: ArrayList
RawWarn.java:7: warning: [unchecked] unchecked call to add(E) as a member of the raw type List
RawWarn.java:8: warning: [unchecked] unchecked conversion
  required: List<String>
  found:    List
4 warnings
```
(Вывод сокращён до первых строк каждого предупреждения.) Без флага компилятор
сообщает только, что проблемы есть. В сборке Maven или Gradle `-Xlint:all` и
`-Werror` превращают их в ошибки.

## Как это работает «под капотом»
Стирание видно в байткоде. Метод `String firstName(List<String> names) { return
names.get(0); }` вызывает `List.get`, который после стирания возвращает
`Object`, и компилятор вставляет `checkcast` к `String`:
```
static java.lang.String firstName(java.util.List<java.lang.String>);
    Code:
       0: aload_0
       1: iconst_0
       2: invokeinterface #7,  2   // InterfaceMethod java/util/List.get:(I)Ljava/lang/Object;
       7: checkcast     #13        // class java/lang/String
      10: areturn
```
Именно эта инструкция `checkcast` бросила `ClassCastException` в примере с
raw-типом: проверка типа происходит в месте использования, а не при записи в
коллекцию.

Но стирание не полное: дескриптор метода — то, по чему JVM его вызывает, —
действительно стёрт до `(Ljava/util/List;)Ljava/lang/String;`. Параллельно
компилятор сохраняет атрибут `Signature` с полной сигнатурой
`(Ljava/util/List<Ljava/lang/String;>;)Ljava/lang/String;`. Его читает
рефлексия: параметры типов полей, методов и суперклассов известны в рантайме.
Неизвестен только параметр конкретного объекта — `new ArrayList<String>()` не
хранит `String` нигде.

```java
static class Holder<T> {
    T plain;
    List<String> names;
}
static abstract class TypeRef<T> {
    Type type() {
        return ((ParameterizedType) getClass().getGenericSuperclass()).getActualTypeArguments()[0];
    }
}
// ...
Field names = Holder.class.getDeclaredField("names");
Field plain = Holder.class.getDeclaredField("plain");
System.out.println("поле names: getType=" + names.getType().getSimpleName() + ", getGenericType=" + names.getGenericType());
System.out.println("поле plain: getType=" + plain.getType().getSimpleName() + ", getGenericType=" + plain.getGenericType());
System.out.println("TypeRef<Map<String, List<Integer>>>: " + new TypeRef<Map<String, List<Integer>>>() {}.type());
```
```
поле names: getType=List, getGenericType=java.util.List<java.lang.String>
поле plain: getType=Object, getGenericType=T
TypeRef<Map<String, List<Integer>>>: java.util.Map<java.lang.String, java.util.List<java.lang.Integer>>
```
Объявленный тип поля `List<String>` доступен целиком. Приём с анонимным
подклассом `new TypeRef<...>() {}` записывает параметр в сигнатуру суперкласса —
так устроены `TypeReference` в Jackson и `ParameterizedTypeReference` в Spring,
которым нужен полный тип для десериализации `List<Order>`.

## Частые вопросы на собеседовании

**Q: Что такое type erasure и зачем он нужен?**
A: Компилятор проверяет типы, а потом стирает параметры: `T` заменяется на
`Object` или свою границу, в местах использования вставляются приведения. В
рантайме `List<String>` и `List<Integer>` — один класс. Так generics добавили в
Java 5 без изменения JVM и с полной совместимостью со старым байткодом.

**Q: Можно ли в рантайме узнать параметр типа?**
A: Параметр конкретного объекта — нет: `new ArrayList<String>()` не хранит
`String`. Но сигнатуры объявлений сохраняются в атрибуте `Signature`: через
рефлексию доступны `List<String>` у поля, параметра или суперкласса. На этом
построен приём «super type token» — анонимный подкласс `TypeReference<List<Order>>`
в Jackson и Spring.

**Q: Что такое raw type и чем он опасен?**
A: Generic-тип без аргументов, например `List` вместо `List<String>`, оставленный
для совместимости с кодом до Java 5. Операции с ним компилятор не проверяет и
лишь предупреждает. Через raw-ссылку в типизированную коллекцию можно положить
чужой объект, и `ClassCastException` вылетит потом при чтении — далеко от
места ошибки.

**Q: Чем generic-метод отличается от метода generic-класса?**
A: Generic-метод объявляет собственные параметры типа (`<T> T first(List<T>)`) и
может быть статическим или находиться в обычном классе. Метод generic-класса
использует параметры класса и привязан к экземпляру `Box<String>`. Тип
generic-метода выводится при каждом вызове отдельно, а при необходимости
указывается явно: `Util.<String>first(list)`.

## Ловушки и частые ошибки

#### «Generics проверяются в рантайме»
Generics — проверка только этапа компиляции. Если её обойти через raw-тип,
непроверяемое приведение или рефлексию, коллекция примет объект любого типа, и
ошибка всплывёт позже. Предупреждения `unchecked` — не шум, а сигнал о месте,
где компилятор больше не гарантирует типы.

#### Raw type в новом коде
`List list = new ArrayList();` компилируется и выглядит безобидно, но отключает
проверки для всех операций с этой переменной. Если тип элементов неизвестен,
пишут `List<?>` или `List<Object>` — это разные вещи, но обе проверяются
компилятором (тема «Границы типов и wildcard»).

#### Поиск метода рефлексией по generic-типу
`getDeclaredMethod("maxOf", Integer.class, Integer.class)` не найдёт
`<T extends Comparable<T>> T maxOf(T, T)`: в байткоде параметры стёрты до
`Comparable`. Рефлексия ищет по стёртым типам, а параметры типов достают через
`getGenericParameterTypes()`.

## Связанные темы
- [Границы типов и wildcard](02-bounded-types-and-wildcards.md) — `extends`, `super` и PECS.
- [Ограничения и подводные камни generics](03-generics-pitfalls.md) — что нельзя сделать из-за стирания.
- [Иерархия коллекций](../05-collections/01-collections-hierarchy.md) — главный потребитель generics.
- [Установка окружения и первая программа](../02-java-core/01-environment-setup.md) — `javap` и чтение байткода.
- Байткод, invokedynamic и Instrumentation API (раздел 9) — дескрипторы и атрибуты class-файла.
- Reflection API (раздел 9) — `Type`, `ParameterizedType` и чтение сигнатур.

## Источники
- [JLS §4.6: Type Erasure](https://docs.oracle.com/javase/specs/jls/se21/html/jls-4.html#jls-4.6), [§4.8: Raw Types](https://docs.oracle.com/javase/specs/jls/se21/html/jls-4.html#jls-4.8).
- [The Java Tutorials: Generics](https://docs.oracle.com/javase/tutorial/java/generics/index.html).
- Joshua Bloch, «Effective Java», 3rd ed.: Item 26 «Don't use raw types», Item 27 «Eliminate unchecked warnings», Item 29 «Favor generic types», Item 30 «Favor generic methods».
- Maurice Naftalin, Philip Wadler, «Java Generics and Collections» (O'Reilly).
