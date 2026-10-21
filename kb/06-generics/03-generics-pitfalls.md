---
title: "Ограничения и подводные камни generics"
section: 6
section_title: "Generics (обобщённое программирование)"
topic_slug: "06-03-generics-pitfalls"
roadmap_ref: "Раздел 6 → Ограничения и подводные камни generics"
status: not-started
tags: [generics, generic-arrays, heap-pollution, bridge-methods, unchecked]
related:
  - "06-01-generics-basics"
  - "06-02-bounded-types-and-wildcards"
  - "02-02-variables-and-types"
  - "02-04-arrays"
  - "03-02-inheritance"
  - "09-10-panama-valhalla-leyden"
last_reviewed: null
---

Почти все ограничения generics вытекают из одного решения — стирания типов. На
собеседовании их спрашивают списком: почему нельзя `new T[]`, `List<int>`,
`instanceof List<String>`, перегрузку по `List<String>` и `List<Integer>`. Senior
должен не только перечислить запреты, но и объяснить каждый через стирание и
знать, как он обходится на практике, — а заодно понимать, что такое heap
pollution и bridge-методы.

## Ключевые концепции

### Ограничения

#### Нельзя создать generic-массив
`new T[10]` и `new List<String>[10]` — ошибка компиляции «generic array
creation». Причина в столкновении двух моделей. Массив в рантайме помнит тип
элементов и проверяет каждую запись (`ArrayStoreException`), а параметр типа
стёрт — массив знал бы только `Object` или `List` и пропустил бы чужой элемент.

Обходные пути. Хранить данные в `List<T>` — это совет Effective Java «предпочитайте
списки массивам». Если массив действительно нужен, передают `Class<T>` и
создают настоящий массив через `Array.newInstance`, как это делает
`List.toArray(T[])`. Приём `(T[]) new Object[n]` допустим только внутри класса,
пока массив не уходит наружу, — так устроен `ArrayList`.

```java
@SuppressWarnings("unchecked")
static <T> T[] newArrayUnsafe(int n) {
    return (T[]) new Object[n];               // на деле это Object[]
}
@SuppressWarnings("unchecked")
static <T> T[] newArray(Class<T> type, int n) {
    return (T[]) Array.newInstance(type, n);  // настоящий T[]
}
// ...
Object[] asObjects = Pitfalls.<String>newArrayUnsafe(2);
System.out.println("внутри метода создан: " + asObjects.getClass().getSimpleName());
String[] strings = Pitfalls.<String>newArrayUnsafe(2);   // перехвачено
String[] real = newArray(String.class, 2);
System.out.println("Array.newInstance: " + real.getClass().getSimpleName() + " длины " + real.length);
```
```
внутри метода создан: Object[]
String[] s = newArrayUnsafe(2): class [Ljava.lang.Object; cannot be cast to class [Ljava.lang.String; ([Ljava.lang.Object; and [Ljava.lang.String; are in module java.base of loader 'bootstrap')
Array.newInstance: String[] длины 2
```
Приведение `(T[])` ничего не проверило: внутри метода `T[]` стёрт до
`Object[]`. Ошибка вылетела при присваивании в `String[]` у вызывающего кода.
`Array.newInstance` с переданным классом создал настоящий `String[]`.

#### Примитивы как параметр типа
Параметром типа может быть только ссылочный тип: `List<Integer>`, но не
`List<int>`. После стирания `T` становится `Object`, а `int` не является
объектом — его нельзя положить в поле типа `Object` без упаковки. Поэтому
generics работают с обёртками, а автоупаковка скрывает это в коде.

Цена — память и время: каждый элемент `List<Integer>` — отдельный объект, а
сравнение через `==` сравнивает ссылки. Для чисел есть специализированные
`IntStream`, `int[]` и сторонние примитивные коллекции. Проект Valhalla
работает над тем, чтобы параметризация примитивами и value-типами стала
возможной.

```java
static class Stack<E> {
    private final List<E> items = new ArrayList<>();
    void push(E e) { items.add(e); }
    E pop() { return items.remove(items.size() - 1); }
}
// ...
Stack<Integer> stack = new Stack<>();
stack.push(1000);
stack.push(1000);
System.out.println("pop() == pop(): " + (stack.pop() == stack.pop()) + " — сравниваются ссылки Integer");
```
```
pop() == pop(): false — сравниваются ссылки Integer
```
Два одинаковых числа оказались разными объектами: 1000 не попадает в кэш
`Integer` (тема «Переменные и типы данных»). Generic-код с `==` для `T`
почти всегда ошибка.

#### instanceof и приведение типов с параметром
`obj instanceof List<String>` — ошибка компиляции: в рантайме объект знает
только, что он `ArrayList`, и проверить `<String>` нечем. С Java 16 такая
проверка разрешена, если компилятор может доказать её безопасность по
статическому типу: `list instanceof ArrayList<String> al` при `List<String> list`.
Универсальная проверка — `obj instanceof List<?>`.

Приведение `(T) obj` или `(List<String>) obj` компилируется с предупреждением
`unchecked`, но в рантайме ничего не проверяет. Неверный объект «проходит»
приведение, и `ClassCastException` вылетает позже — там, где компилятор вставил
`checkcast` к конкретному типу.

```java
@SuppressWarnings("unchecked")
static <T> T unsafeCast(Object o) {
    return (T) o;                             // проверки типа здесь нет
}
// ...
Object boxed = 42;
String s = unsafeCast(boxed);                 // перехвачено

List<String> list = new ArrayList<>(List.of("a"));
if (list instanceof ArrayList<String> al) {
    System.out.println("list instanceof ArrayList<String>: true, al.size()=" + al.size());
}
Object obj = list;
System.out.println("obj instanceof List<?>: " + (obj instanceof List<?>));
```
```
String s = unsafeCast(42): class java.lang.Integer cannot be cast to class java.lang.String (java.lang.Integer and java.lang.String are in module java.base of loader 'bootstrap')
list instanceof ArrayList<String>: true, al.size()=1
obj instanceof List<?>: true
```
Приведение внутри `unsafeCast` «прошло», а упало присваивание у вызывающего
кода. Проверка `ArrayList<String>` разрешена, потому что параметр `<String>`
известен из типа `list`.

Ошибки компиляции для этих случаев (собраны из одного файла `LimitsFail.java`):
```
LimitsFail.java:6: error: generic array creation
    T[] create(int n) { return new T[n]; }
                               ^
LimitsFail.java:8: error: generic array creation
    List<String>[] table = new List<String>[10];
                           ^
LimitsFail.java:10: error: unexpected type
    List<int> numbers;
         ^
  required: reference
  found:    int
LimitsFail.java:12: error: Object cannot be safely cast to List<String>
    boolean check(Object o) { return o instanceof List<String>; }
                                     ^
```
Все четыре запрета ловит компилятор, до запуска программы.

### Технические детали

#### Unchecked warnings и heap pollution
Предупреждение `unchecked` означает: здесь компилятор больше не может
гарантировать типы. Оно возникает при работе с raw-типами, непроверяемых
приведениях и generic-varargs. Каждое такое место — потенциальная heap
pollution: переменная `List<String>` начинает ссылаться на объект, внутри
которого не строки.

Effective Java (Item 27) советует устранять каждое предупреждение, а если код
доказуемо безопасен — подавлять `@SuppressWarnings("unchecked")` на минимальной
области (одна переменная, один метод) с комментарием, почему это безопасно.
Подавление на весь класс прячет будущие настоящие проблемы.

Особый случай — generic-varargs. Параметр `T...` — это массив `T[]`, а
generic-массивы, как выяснено выше, ненадёжны. Метод, который отдаёт такой
массив наружу, может вернуть `Object[]` там, где ждут `String[]`:
```java
static <T> T[] toArray(T... args) { return args; }

static <T> T[] pickTwo(T a, T b, T c) {
    return toArray(a, b);                     // массив создаётся как Object[]
}

@SafeVarargs
static <T> List<T> listOf(T... items) {      // не пишет в массив и не отдаёт его наружу
    return new ArrayList<>(Arrays.asList(items));
}
// ...
String[] two = pickTwo("a", "b", "c");        // перехвачено
System.out.println("@SafeVarargs listOf: " + listOf("x", "y"));
```
```
String[] two = pickTwo(...): class [Ljava.lang.Object; cannot be cast to class [Ljava.lang.String; ([Ljava.lang.Object; and [Ljava.lang.String; are in module java.base of loader 'bootstrap')
@SafeVarargs listOf: [x, y]
```
Внутри `pickTwo` параметр `T` стёрт, и для вызова `toArray(a, b)` создан массив
`Object[]` — он и вернулся в `String[]`. `@SafeVarargs` ставят только на методы,
которые не пишут в массив varargs и не отдают его наружу, как `listOf` или
`List.of`.

Компилятор предупреждает об этом и в объявлении, и в вызове:
```
$ javac -Xlint:unchecked VarargsWarn.java
VarargsWarn.java:4: warning: [unchecked] Possible heap pollution from parameterized vararg type T
    static <T> T[] toArray(T... args) { return args; }
                                ^
VarargsWarn.java:8: warning: [unchecked] unchecked generic array creation for varargs parameter of type List<String>[]
        Object o = toArray(a, a);
                          ^
```

#### Bridge-методы
Стирание ломает переопределение. Класс `Node<T>` после стирания имеет метод
`setData(Object)`, а наследник `IntNode extends Node<Integer>` объявляет
`setData(Integer)` — с другой сигнатурой, то есть формально перегрузку, а не
переопределение. Вызов `node.setData(7)` через ссылку на `Node` попал бы в
родительскую реализацию.

Чтобы полиморфизм работал, компилятор генерирует в `IntNode` синтетический
bridge-метод `setData(Object)`, который приводит аргумент к `Integer` и вызывает
настоящий `setData(Integer)`. Тот же механизм используется для ковариантного
возвращаемого типа (тема «Наследование»).

```java
static class Node<T> {
    T data;
    void setData(T data) { this.data = data; }
}
static class IntNode extends Node<Integer> {
    @Override
    void setData(Integer data) {
        System.out.println("IntNode.setData(" + data + ")");
        super.setData(data);
    }
}
// ...
Node<Integer> node = new IntNode();
node.setData(7);                          // вызов через ссылку на Node<Integer>
for (Method m : IntNode.class.getDeclaredMethods()) {
    if (m.getName().equals("setData")) {
        System.out.println("IntNode." + m.getName() + "(" + m.getParameterTypes()[0].getSimpleName() + ") bridge=" + m.isBridge() + " synthetic=" + m.isSynthetic());
    }
}
Node rawNode = new IntNode();
rawNode.setData("строка");                // перехвачено
```
```
IntNode.setData(7)
IntNode.setData(Integer) bridge=false synthetic=false
IntNode.setData(Object) bridge=true synthetic=true
rawNode.setData("строка"): class java.lang.String cannot be cast to class java.lang.Integer (java.lang.String and java.lang.Integer are in module java.base of loader 'bootstrap')
```
В `IntNode` два метода `setData`: написанный руками и синтетический мост с
параметром `Object`. Через ссылку на `Node` вызов прошёл через мост в
`setData(Integer)`. Строка через raw-тип упала с `ClassCastException` внутри
моста — это его приведение к `Integer`.

## Частые вопросы на собеседовании

**Q: Почему нельзя написать new T[] и как обойти это ограничение?**
A: Массив в рантайме проверяет тип каждого элемента, а `T` стёрт — массив не знал
бы, что проверять. Обходы: использовать `List<T>`; передать `Class<T>` и вызвать
`Array.newInstance`; внутри класса хранить `Object[]` с приведением `(T[])`,
не отдавая массив наружу, как `ArrayList`. Отдавать наружу `(T[]) new Object[n]`
нельзя — вызывающий получит `ClassCastException`.

**Q: Что такое bridge-метод?**
A: Синтетический метод, который компилятор добавляет наследнику
generic-класса, чтобы переопределение работало после стирания. Для
`IntNode extends Node<Integer>` с `setData(Integer)` генерируется
`setData(Object)`, который приводит аргумент и вызывает настоящий метод. Его
видно в `javap` и через `Method.isBridge()`.

**Q: Что такое heap pollution?**
A: Ситуация, когда переменная параметризованного типа ссылается на объект
неподходящего типа: `List<String>`, в котором лежит `Integer`. Возникает через
raw-типы, непроверяемые приведения и generic-varargs. Ошибка проявляется не в
месте загрязнения, а позже, при чтении, — `ClassCastException` в коде, который
выглядит корректным.

**Q: Можно ли перегрузить метод для `List<String>` и `List<Integer>`?**
A: Нет: после стирания у обоих сигнатура `print(List)`, и компилятор сообщает
«name clash: ... have the same erasure». Перегрузку заменяют разными именами
методов или общим методом с параметром типа.

**Q: Когда уместна аннотация @SafeVarargs?**
A: На методах с generic-varargs, которые не записывают ничего в массив
параметров и не отдают ссылку на него наружу — только читают элементы. Тогда
heap pollution невозможна, и предупреждение можно подавить. Аннотация
разрешена на `static`, `final` и `private` методах и конструкторах: их нельзя
переопределить небезопасной версией.

## Ловушки и частые ошибки

#### Перегрузка с одинаковым стиранием
Пара методов, различающихся только параметром типа, не компилируется:
```java
void print(List<String> list) { }
void print(List<Integer> list) { }
```
```
LimitsFail.java:17: error: name clash: print(List<Integer>) and print(List<String>) have the same erasure
```
В байткоде оба метода были бы `print(List)`, а JVM различает методы только по
стёртому дескриптору.

#### static-поле типа T и new T()
Параметр типа относится к экземпляру: у `Box<String>` и `Box<Integer>` один класс
и одни статические поля, поэтому `static T shared` бессмысленно и запрещено.
`new T()` невозможен по той же причине, что и `new T[]`: в рантайме неизвестно,
какой класс создавать. Решение — фабрика `Supplier<T>` или `Class<T>` в
конструкторе.
```
LimitsFail.java:4: error: non-static type variable T cannot be referenced from a static context
LimitsFail.java:14: error: unexpected type
  required: class
  found:    type parameter T
```

#### Generic-исключения
`class AppException<T> extends Exception` не компилируется: «a generic class may
not extend java.lang.Throwable». Блок `catch` выбирает обработчик по типу в
рантайме, а параметр стёрт — `catch (AppException<String>)` и
`catch (AppException<Integer>)` были бы неразличимы. Контекст в исключение
передают обычными полями.

#### @SuppressWarnings на весь класс
Аннотация `@SuppressWarnings("unchecked")` на классе глушит не только
проверенное безопасное место, но и все будущие предупреждения. Через год в
этом классе появляется настоящая heap pollution, и компилятор о ней молчит.
Подавляют на самой узкой области — переменной или методе — с комментарием.

## Связанные темы
- [Основы generics](01-generics-basics.md) — стирание типов и raw-типы.
- [Границы типов и wildcard](02-bounded-types-and-wildcards.md) — инвариантность и почему нельзя `List<String>[]`.
- [Массивы](../02-java-core/04-arrays.md) — ковариантность и `ArrayStoreException`.
- [Переменные и типы данных](../02-java-core/02-variables-and-types.md) — автоупаковка и кэш `Integer`.
- [Наследование](../03-oop/02-inheritance.md) — bridge-методы для ковариантного возвращаемого типа.
- [Методы](../02-java-core/05-methods.md) — varargs как массив.
- Project Panama, Valhalla и Leyden (раздел 9) — будущие generics над примитивами.

## Источники
- [JLS §15.10.1: Array Creation Expressions](https://docs.oracle.com/javase/specs/jls/se21/html/jls-15.html#jls-15.10.1), [§8.4.8.3: Requirements in Overriding and Hiding](https://docs.oracle.com/javase/specs/jls/se21/html/jls-8.html#jls-8.4.8.3), [§9.6.4.7: @SafeVarargs](https://docs.oracle.com/javase/specs/jls/se21/html/jls-9.html#jls-9.6.4.7).
- [The Java Tutorials: Restrictions on Generics](https://docs.oracle.com/javase/tutorial/java/generics/restrictions.html), [Effects of Type Erasure and Bridge Methods](https://docs.oracle.com/javase/tutorial/java/generics/bridgeMethods.html).
- Joshua Bloch, «Effective Java», 3rd ed.: Item 27 «Eliminate unchecked warnings», Item 28 «Prefer lists to arrays», Item 32 «Combine generics and varargs judiciously».
- [JEP 394: Pattern Matching for instanceof](https://openjdk.org/jeps/394) — проверки `instanceof` с параметризованными типами.
