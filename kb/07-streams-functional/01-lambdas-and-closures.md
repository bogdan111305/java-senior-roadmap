---
title: "Лямбда-выражения и замыкания"
section: 7
section_title: "Функциональный стиль и Stream API (Java 8+)"
topic_slug: "07-01-lambdas-and-closures"
roadmap_ref: "Раздел 7 → Лямбда-выражения и замыкания"
status: not-started
tags: [lambda, closures, method-references, functional-interface, invokedynamic]
related:
  - "07-02-functional-interfaces"
  - "07-03-stream-api"
  - "03-08-nested-classes"
  - "03-04-abstract-vs-interface"
  - "04-01-exception-hierarchy"
  - "09-08-bytecode-and-invokedynamic"
last_reviewed: null
---

Лямбды (Java 8) — синтаксическая основа всего функционального стиля в Java:
Stream API, `CompletableFuture`, колбэков в Spring. На собеседовании проверяют
не синтаксис, а модель: откуда лямбда знает свой тип, почему захваченная
переменная должна быть effectively final, чем `obj::method` отличается от
`() -> obj.method()` и чем лямбда в байткоде отличается от анонимного класса.

## Ключевые концепции

### Синтаксис

#### Формы записи: выражение и блок
Лямбда — это реализация единственного абстрактного метода функционального
интерфейса, записанная как значение: `(параметры) -> тело`. Тело-выражение
возвращает своё значение без `return`: `(a, b) -> a + b`. Тело-блок `{ ... }` может
содержать несколько инструкций и требует явного `return`, если метод возвращает
значение.

Скобки вокруг единственного параметра без типа можно опустить: `s -> s.length()`.
Типы параметров обычно выводятся, но их можно указать явно, а с Java 11 — через
`var`, чтобы повесить на параметр аннотацию: `(@NonNull var s) -> ...`. Либо все
параметры с типами, либо все без — смешивать нельзя.

```java
BinaryOperator<Integer> add = (a, b) -> a + b;
BiFunction<Integer, Integer, Integer> addTyped = (Integer a, Integer b) -> a + b;
Function<String, String> shout = s -> s.toUpperCase() + "!";
Supplier<List<String>> block = () -> {
    List<String> list = new ArrayList<>();
    list.add("из блока");
    return list;
};
BiFunction<String, String, String> withVar = (var a, var b) -> a + "-" + b;
System.out.println(add.apply(2, 3) + " " + addTyped.apply(4, 5) + " " + shout.apply("hi") + " " + block.get() + " " + withVar.apply("x", "y"));
```
```
5 9 HI! [из блока] x-y
```
Все пять форм записи равноправны: выбирают ту, что короче читается. Блочная
форма оправдана, когда в теле действительно несколько шагов.

#### Target type: тип лямбды берётся из контекста
У лямбды нет собственного типа: один и тот же текст `() -> "готово"` может стать
`Supplier<String>` или `Callable<String>`. Тип определяет контекст — переменная,
параметр метода, приведение или `return`. Его называют target type, и от него же
компилятор выводит типы параметров лямбды.

Отсюда два следствия. Лямбду нельзя присвоить в `var` или `Object` без
приведения — выводить тип не из чего. А при перегрузке метода с разными
функциональными интерфейсами одной и той же формы вызов становится
неоднозначным.

```java
Supplier<String> asSupplier = () -> "готово";
Callable<String> asCallable = () -> "готово";
System.out.println("одна и та же лямбда: " + asSupplier.get() + " / " + asCallable.call());
System.out.println("классы: " + asSupplier.getClass().getInterfaces()[0].getSimpleName() + " / " + asCallable.getClass().getInterfaces()[0].getSimpleName());
```
```
одна и та же лямбда: готово / готово
классы: Supplier / Callable
```
Текст лямбд одинаковый, а объекты реализуют разные интерфейсы — каждый тот, что
потребовал контекст. Когда контекста нет или он двусмысленный, компилятор
останавливается:
```java
static void run(Supplier<String> s) { }
static void run(Callable<String> c) { }
// ...
run(() -> "x");
var f = x -> x * 2;
```
```
LambdaFail.java:18: error: reference to run is ambiguous
        run(() -> "x");
        ^
  both method run(Supplier<String>) in LambdaFail and method run(Callable<String>) in LambdaFail match
LambdaFail.java:20: error: cannot infer type for local variable f
        var f = x -> x * 2;
            ^
  (lambda expression needs an explicit target-type)
```
Та же неоднозначность встречается в `ExecutorService.submit` с `Runnable` и
`Callable`; её разрешают приведением `(Callable<String>) () -> "x"` или
переименованием перегрузок.

### Замыкания

#### @FunctionalInterface: ровно один абстрактный метод
Лямбду можно передать туда, где ожидается функциональный интерфейс — интерфейс
с единственным абстрактным методом (SAM, single abstract method). Default- и
static-методы не считаются, абстрактные методы `Object` (`equals`, `hashCode`,
`toString`) — тоже: любая реализация получает их от `Object`. Аннотация
`@FunctionalInterface` не обязательна, но заставляет компилятор проверить это
правило (пример ошибки — в теме «Enum и аннотации»).

```java
for (Method m : Comparator.class.getMethods()) {
    if (Modifier.isAbstract(m.getModifiers())) System.out.println("abstract: " + m.getName() + Arrays.toString(m.getParameterTypes()));
}
```
```
abstract: equals[class java.lang.Object]
abstract: compare[class java.lang.Object, class java.lang.Object]
```
У `Comparator` два абстрактных метода, но `equals` повторяет метод `Object` и
не мешает интерфейсу оставаться функциональным. Лямбда реализует только
`compare`.

#### Effectively final: что можно захватывать
Лямбда может использовать локальные переменные объемлющего метода — это
замыкание (closure). Условие: переменная final или effectively final, то есть
после инициализации ей ничего не присваивается. Лямбда получает копию значения,
а не ссылку на переменную, поэтому разрешить изменения означало бы получить две
расходящиеся версии одной переменной — в методе и в лямбде.

Ограничение касается переменных, а не объектов. Поля класса лямбда читает и
меняет через захваченный `this`, а изменяемый объект — `AtomicInteger`, список —
можно менять через захваченную ссылку. Переменная цикла for-each создаётся
заново на каждой итерации и поэтому effectively final, а счётчик классического
`for (int i...)` — нет.

```java
int base = 10;                              // effectively final
IntUnaryOperator plusBase = x -> x + base;
AtomicInteger counter = new AtomicInteger();
Runnable inc = counter::incrementAndGet;    // меняем объект, а не переменную
inc.run(); inc.run();
System.out.println("plusBase(5)=" + plusBase.applyAsInt(5) + ", counter=" + counter.get());
List<Supplier<String>> suppliers = new ArrayList<>();
for (String name : List.of("a", "b", "c")) suppliers.add(() -> name);   // переменная for-each — новая на каждой итерации
// ... склеиваем результаты suppliers
```
```
plusBase(5)=15, counter=2
захват в for-each: abc
```
Счётчик изменился через объект `AtomicInteger`, а каждая лямбда в цикле
for-each запомнила свою копию `name`. Нарушения правила компилятор не
пропускает:
```java
int count = 0;
Runnable r = () -> count++;
for (int i = 0; i < 3; i++) {
    list.add(() -> i);
}
```
```
CaptureFail.java:7: error: local variables referenced from a lambda expression must be final or effectively final
        Runnable r = () -> count++;
                           ^
CaptureFail.java:11: error: local variables referenced from a lambda expression must be final or effectively final
            list.add(() -> i);
                           ^
```
В классическом `for` переменная `i` одна на весь цикл и меняется после каждой
итерации — захватить её нельзя. Решение — локальная копия `int copy = i;` внутри
тела цикла.

#### Method references
Ссылка на метод — краткая запись лямбды, которая только вызывает существующий
метод. Четыре вида: статический метод `Integer::parseInt`; метод конкретного
объекта `user::greet`; метод произвольного объекта своего типа
`String::toUpperCase`, где получателем становится первый аргумент; конструктор
`User::new` и конструктор массива `int[]::new`.

Важное отличие от лямбды — момент вычисления получателя. В `obj::method` выражение
`obj` вычисляется сразу при создании ссылки, и если оно `null`, сразу же
вылетает `NullPointerException`. Лямбда `() -> obj.method()` обращается к `obj`
только при вызове.

```java
Function<String, Integer> parse = Integer::parseInt;              // статический
User anna = new User("Аня");
Function<String, String> bound = anna::greet;                    // метод конкретного объекта
Function<String, String> unbound = String::toUpperCase;          // первый аргумент — получатель
BiFunction<User, String, String> unbound2 = User::greet;
Function<String, User> ctor = User::new;                          // конструктор
IntFunction<int[]> arrayCtor = int[]::new;
System.out.println(parse.apply("42") + 1);
System.out.println(bound.apply("Боб"));
System.out.println(unbound.apply("abc") + " / " + unbound2.apply(new User("Ира"), "Олег"));
System.out.println(ctor.apply("Петя") + ", int[]::new -> длина " + arrayCtor.apply(3).length);
```
```
43
Аня приветствует Боб
ABC / Ира приветствует Олег
User[name=Петя], int[]::new -> длина 3
```
`User::greet` превратился в функцию двух аргументов: первый — объект, у которого
вызывается метод, второй — его параметр.

Разница в моменте вычисления получателя:
```java
User nobody = null;
Supplier<String> lazy = () -> nobody.greet("x");   // NPE только при вызове
System.out.println("лямбда с null создана");
Supplier<String> eager = nobody::name;             // перехвачено: NPE прямо здесь
lazy.get();                                        // перехвачено
```
```
лямбда с null создана
nobody::name -> NPE при создании ссылки
lazy.get() -> NPE при вызове
```
Замена лямбды на ссылку на метод при рефакторинге может перенести исключение
в другое место — например, из ленивого `orElseGet` в момент создания аргумента.

## Как это работает «под капотом»
Лямбда — не анонимный класс. Компилятор выносит её тело в приватный
синтетический метод `lambda$main$0`, а в месте создания лямбды ставит инструкцию
`invokedynamic`. При первом выполнении JVM вызывает bootstrap-метод
`LambdaMetafactory`, который генерирует в памяти скрытый класс, реализующий
функциональный интерфейс, — без отдельного `.class`-файла на диске.

```java
String greeting = "привет";
Supplier<String> s = () -> greeting + "!";
```
```
$ javap -c -p Indy
       4: invokedynamic #9,  0    // InvokeDynamic #0:get:(Ljava/lang/String;)Ljava/util/function/Supplier;
  private static java.lang.String lambda$main$0(java.lang.String);
```
Захваченная переменная `greeting` передаётся параметром и в фабрику
(`get:(Ljava/lang/String;)`), и в синтетический метод. Так и устроен «захват по
значению».

Лямбда без захвата создаётся один раз: `invokedynamic` после первого вызова
возвращает один и тот же объект. Лямбда с захватом — новый объект на каждое
вычисление, потому что у каждого свои значения.
```java
List<Object> nonCapturing = new ArrayList<>(), capturing = new ArrayList<>();
for (int i = 0; i < 2; i++) {
    nonCapturing.add((Supplier<String>) () -> "const");
    int copy = i;
    capturing.add((Supplier<Integer>) () -> copy);
}
System.out.println("без захвата — один объект: " + (nonCapturing.get(0) == nonCapturing.get(1)));
System.out.println("с захватом — разные: " + (capturing.get(0) == capturing.get(1)));
System.out.println("класс лямбды: " + nonCapturing.get(0).getClass().getName());
```
```
без захвата — один объект: true
с захватом — разные: false
класс лямбды: Lambdas$$Lambda/0x…
```
(Адрес скрытого класса в выводе сокращён.) Поэтому лямбды без захвата почти
бесплатны, а сравнивать лямбды через `==` бессмысленно: результат — деталь
реализации. В отличие от анонимного класса, `this` внутри лямбды — объемлющий
объект (тема «Вложенные и анонимные классы»).

## Частые вопросы на собеседовании

**Q: Почему захватываемая переменная должна быть effectively final?**
A: Лямбда получает копию значения локальной переменной, а не ссылку на неё:
локальная переменная живёт в кадре стека и может исчезнуть раньше лямбды.
Если бы переменную можно было менять, копия в лямбде и оригинал в методе
разошлись бы. Изменяемое состояние передают через объект — `AtomicInteger`,
коллекцию — или поле класса.

**Q: Как компилятор узнаёт тип лямбды?**
A: Из target type — контекста, куда лямбда передаётся: тип переменной,
параметра, результата или приведения. Он должен быть функциональным интерфейсом,
и по его единственному методу выводятся типы параметров. Без контекста —
например, в `var` — тип вывести нельзя; при перегрузках вызов может стать
неоднозначным.

**Q: Чем лямбда отличается от анонимного класса?**
A: Лямбда компилируется в приватный метод и `invokedynamic`, а класс-реализация
создаётся в рантайме `LambdaMetafactory`; анонимный класс — отдельный
`.class`-файл. `this` в лямбде — объемлющий объект, в анонимном классе — сам
анонимный объект. Лямбда без захвата создаётся один раз, анонимный класс — при
каждом `new`. Анонимный класс может иметь состояние и реализовать интерфейс с
несколькими методами.

**Q: Какие бывают ссылки на методы?**
A: На статический метод (`Integer::parseInt`), на метод конкретного объекта
(`user::greet`, `System.out::println`), на метод произвольного объекта типа
(`String::length`, получатель — первый аргумент) и на конструктор
(`ArrayList::new`, `int[]::new`). У ссылки на метод объекта получатель
вычисляется при создании ссылки, а не при вызове.

## Ловушки и частые ошибки

#### Изменяемое состояние через обходные пути
Приём «обернуть счётчик в массив `int[1]`» компилируется, но превращает лямбду в
носитель скрытого изменяемого состояния. В параллельном стриме или другом потоке
это гонка данных. Если нужно накопить результат — используют `reduce`,
`collect` или `AtomicInteger`/`LongAdder`, а не мутацию захваченного объекта.

#### Ссылка на метод null-объекта
`Optional.orElseGet(config::defaultValue)` при `config == null` упадёт сразу, ещё
до проверки `Optional`, а лямбда `() -> config.defaultValue()` упала бы только при
пустом `Optional`. Порядок вычисления разный — и это не всегда безопасная замена
при рефакторинге.

#### Длинные многострочные лямбды
Лямбда на двадцать строк с вложенными условиями читается хуже обычного метода и
плохо отображается в стектрейсе (`lambda$process$3`). Логику выносят в
именованный метод и передают ссылкой на него — так её проще читать,
тестировать и находить в логах.

#### Checked-исключения внутри лямбды
Лямбда, реализующая `Function` или `Consumer`, не может бросить checked-исключение
наружу: в сигнатуре их методов нет `throws`. Исключение приходится ловить
внутри и оборачивать в unchecked (тема «Иерархия исключений»).

## Связанные темы
- [Стандартные функциональные интерфейсы](02-functional-interfaces.md) — готовые типы для лямбд.
- [Stream API](03-stream-api.md) — главный потребитель лямбд.
- [Вложенные и анонимные классы](../03-oop/08-nested-classes.md) — анонимные классы и `this` в лямбде.
- [Абстракция: abstract class vs interface](../03-oop/04-abstract-vs-interface.md) — функциональные интерфейсы и default-методы.
- [Иерархия исключений](../04-exceptions/01-exception-hierarchy.md) — checked-исключения в лямбдах.
- Байткод, invokedynamic и Instrumentation API (раздел 9) — `invokedynamic` и bootstrap-методы.

## Источники
- [JLS §15.27: Lambda Expressions](https://docs.oracle.com/javase/specs/jls/se21/html/jls-15.html#jls-15.27), [§15.13: Method Reference Expressions](https://docs.oracle.com/javase/specs/jls/se21/html/jls-15.html#jls-15.13).
- [JEP 126: Lambda Expressions & Virtual Extension Methods](https://openjdk.org/jeps/126), [JEP 323: Local-Variable Syntax for Lambda Parameters](https://openjdk.org/jeps/323).
- Brian Goetz, [«Translation of Lambda Expressions»](https://cr.openjdk.org/~briangoetz/lambda/lambda-translation.html) — как javac компилирует лямбды.
- Joshua Bloch, «Effective Java», 3rd ed.: Item 42 «Prefer lambdas to anonymous classes», Item 43 «Prefer method references to lambdas».
