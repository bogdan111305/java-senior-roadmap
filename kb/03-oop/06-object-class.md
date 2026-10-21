---
title: "Класс Object — универсальный суперкласс"
section: 3
section_title: "Объектно-ориентированное программирование"
topic_slug: "03-06-object-class"
roadmap_ref: "Раздел 3 → Класс Object — универсальный суперкласс"
status: not-started
tags: [oop, object, equals, hashcode, tostring, clone, finalize]
related:
  - "03-02-inheritance"
  - "03-07-comparable-comparator"
  - "05-04-hashmap-internals"
  - "08-04-thread-interaction-and-deadlock"
  - "09-05-gc-roots-and-leaks"
  - "03-01-encapsulation"
last_reviewed: null
---

`Object` — корень иерархии классов Java: любой класс наследует его методы,
даже если `extends` не написан. На собеседовании через эту тему проверяют
контракт `equals`/`hashCode`, от которого зависит корректность `HashMap`, и
знание того, почему `clone()` и `finalize()` сегодня считаются ошибками
дизайна языка.

## Ключевые концепции

### Место в иерархии

#### Неявный extends Object
Если класс не указывает родителя, компилятор подставляет `extends Object`.
Поэтому у любого объекта есть `equals`, `hashCode`, `toString`, `getClass` и
остальные методы `Object`, а переменной типа `Object` можно присвоить что
угодно, кроме примитива (примитив сначала будет упакован в обёртку).

`Object` — единственный класс без родителя: `Object.class.getSuperclass()`
возвращает `null`. У интерфейсов `getSuperclass()` тоже `null`, но объект,
реализующий интерфейс, всё равно является наследником `Object`.

#### Массивы — тоже объекты
Массивы в Java — объекты, и их класс наследует `Object` напрямую: у `int[]`
суперкласс `java.lang.Object`. Поэтому на массиве можно вызвать `hashCode()`
или `toString()`, но они унаследованы от `Object` и сравнивают и печатают
ссылку, а не содержимое. Для содержимого существуют `Arrays.equals`,
`Arrays.hashCode` и `Arrays.toString`.

### getClass(), equals(), hashCode(), toString() — поведение по умолчанию

#### getClass()
`getClass()` — `final`-метод, возвращающий объект `Class<?>` реального класса
объекта в рантайме, независимо от типа переменной. В отличие от `instanceof`,
он не учитывает иерархию: `getClass() == Point.class` ложно для наследника
`Point`. Это используется, когда важен точный класс, — например, в одном из
вариантов `equals`.

#### equals() по умолчанию
Реализация `Object.equals` — просто `this == obj`, то есть сравнение
идентичности: равен только сам объект себе. Для классов-значений (деньги,
координаты, идентификаторы) это почти всегда не то, что нужно: два объекта
`Point(1, 2)` логически равны, но по умолчанию `equals` вернёт `false`.

#### hashCode() по умолчанию
`Object.hashCode` возвращает identity hash code — число, привязанное к
конкретному объекту. Вопреки распространённому мифу, это не адрес в памяти:
сборщик мусора перемещает объекты, а хеш обязан оставаться постоянным. В
HotSpot он генерируется псевдослучайно при первом запросе и сохраняется в
заголовке объекта (mark word).

Тот же хеш доступен через `System.identityHashCode(obj)` даже для объектов,
у которых `hashCode` переопределён. Это полезно, например, в
`IdentityHashMap`, где ключи сравниваются по ссылке.

#### toString() по умолчанию
`Object.toString` возвращает `getClass().getName() + "@" +
Integer.toHexString(hashCode())` — та самая строка вида
`com.example.Point@1b6d3586`. Хеш в ней тоже не адрес. Переопределять
`toString` стоит почти всегда: он попадает в логи, сообщения исключений и
отладчик.

Поведение методов `Object` по умолчанию:
```java
static class Point {
    final int x, y;
    Point(int x, int y) { this.x = x; this.y = y; }
}
// main:
Point a = new Point(1, 2), b = new Point(1, 2);
System.out.println("toString: " + a);
System.out.println("a.equals(b): " + a.equals(b));
System.out.println("hashCode == identityHashCode: " + (a.hashCode() == System.identityHashCode(a)));
System.out.println("Object.class.getSuperclass(): " + Object.class.getSuperclass());
int[] arr = {1, 2};
System.out.println("int[] superclass: " + arr.getClass().getSuperclass().getName() + ", toString: " + arr);
```
```
toString: Defaults$Point@534df152
a.equals(b): false
hashCode == identityHashCode: true
Object.class.getSuperclass(): null
int[] superclass: java.lang.Object, toString: [I@52e677af
```
Два логически одинаковых объекта не равны — `equals` сравнивает ссылки.
`[I` в `toString` массива — внутреннее имя класса `int[]`.

### Контракт equals(): как переопределять правильно

#### Четыре свойства отношения равенства
Контракт `equals` в javadoc описывает отношение эквивалентности.
Рефлексивность: `x.equals(x)` всегда `true`. Симметричность: `x.equals(y)`
равно `y.equals(x)`. Транзитивность: если `x.equals(y)` и `y.equals(z)`, то и
`x.equals(z)`.

Согласованность: повторные вызовы на неизменённых объектах дают один и тот же
результат. И отдельное правило: `x.equals(null)` всегда `false`, а не
`NullPointerException`. Коллекции полагаются на эти свойства молча — при
нарушении они не бросают исключений, а просто ведут себя неправильно.

#### Как обычно нарушают симметричность
Типичный способ нарушить симметричность — попытаться «подружить» свой класс с
чужим. Например, `CaseInsensitiveString.equals` принимает и `String`,
сравнивая без учёта регистра. Но `String.equals` о нашем классе ничего не
знает и вернёт `false` — равенство работает только в одну сторону, и
`list.contains` начинает зависеть от того, кто кого сравнивает.

Нарушение симметричности:
```java
static final class CaseInsensitiveString {
    private final String s;
    CaseInsensitiveString(String s) { this.s = s; }
    @Override public boolean equals(Object o) {
        if (o instanceof CaseInsensitiveString cis) return s.equalsIgnoreCase(cis.s);
        if (o instanceof String str) return s.equalsIgnoreCase(str); // «дружим» со String в одну сторону
        return false;
    }
    @Override public int hashCode() { return s.toLowerCase().hashCode(); }
}
// main:
CaseInsensitiveString cis = new CaseInsensitiveString("Java");
String s = "java";
System.out.println("cis.equals(s): " + cis.equals(s));
System.out.println("s.equals(cis): " + s.equals(cis));
List<CaseInsensitiveString> list = new ArrayList<>(List.of(cis));
System.out.println("list.contains(s): " + list.contains(s));
```
```
cis.equals(s): true
s.equals(cis): false
list.contains(s): false
```
`ArrayList.contains(s)` вызывает `s.equals(элемент)`, то есть сравнение со
стороны `String`, и получает `false`. Результат зависит от реализации
коллекции — классический признак сломанного контракта.

#### instanceof или getClass()
Самая трудная часть — наследование. Если `equals` проверяет `instanceof`, то
наследник с дополнительным значимым полем (`ColorPoint` с цветом) не может
корректно учесть это поле: любая попытка ломает симметричность или
транзитивность. Effective Java формулирует это жёстко — невозможно расширить
инстанцируемый класс, добавить значимое поле и сохранить контракт `equals`.

Проверка `getClass() != o.getClass()` сохраняет контракт, но нарушает принцип
подстановки Лисков: наследник, не добавивший ни одного поля, уже никогда не
равен родителю. Практические выходы — делать классы-значения `final`
(как `record`) или использовать композицию вместо наследования.

Нарушение транзитивности при наследовании с `instanceof`:
```java
static class Point {
    final int x, y;
    @Override public boolean equals(Object o) {
        if (!(o instanceof Point p)) return false;     // instanceof пропускает подклассы
        return p.x == x && p.y == y;
    }
    // hashCode, конструктор
}
static class ColorPoint extends Point {
    final String color;
    @Override public boolean equals(Object o) {       // хотим учитывать цвет
        if (!(o instanceof Point)) return false;
        if (!(o instanceof ColorPoint cp)) return o.equals(this); // с «простой» точкой — без цвета
        return super.equals(cp) && cp.color.equals(color);
    }
}
// main:
ColorPoint red = new ColorPoint(1, 2, "red");
Point plain = new Point(1, 2);
ColorPoint blue = new ColorPoint(1, 2, "blue");
System.out.println("red.equals(plain)  = " + red.equals(plain));
System.out.println("plain.equals(blue) = " + plain.equals(blue));
System.out.println("red.equals(blue)   = " + red.equals(blue));
```
```
red.equals(plain)  = true
plain.equals(blue) = true
red.equals(blue)   = false
```
Симметричность здесь сохранена, но транзитивность нарушена: красная точка
равна простой, простая равна синей, а красная синей — нет. Это и есть
формулировка Effective Java: добавить значимое поле в наследнике и сохранить
контракт нельзя.

#### Рецепт хорошего equals
Порядок проверок в типичной реализации такой. Проверка `this == o` для
быстрого пути, затем проверка типа (`instanceof` с pattern matching, которая
заодно отсекает `null`), затем сравнение значимых полей. Примитивы сравнивают
через `==`, кроме `float`/`double` (`Float.compare`, `Double.compare` из-за
`NaN` и `-0.0`), ссылочные поля — через `Objects.equals`, допускающий `null`.

### Почему hashCode() обязателен вместе с equals()

#### Контракт hashCode
Если `a.equals(b)`, то обязано быть `a.hashCode() == b.hashCode()`. Обратное
не требуется: у неравных объектов хеши могут совпасть — это коллизия, она
допустима, хотя ухудшает производительность хеш-таблиц. Кроме того, хеш
должен быть стабилен, пока не меняются поля, участвующие в `equals`.

#### Что ломается при нарушении
`HashMap` и `HashSet` ищут объект в два шага: по `hashCode` выбирают корзину
(bucket), и только внутри неё сравнивают кандидатов через `equals` (устройство
`HashMap` — раздел 5). Если `equals` переопределён, а `hashCode` нет, два
равных объекта получат разные identity-хеши и окажутся в разных корзинах.
Поиск идёт в «чужую» корзину и объект «не находится», хотя в коллекции лежит
равный ему.

Та же поломка случается с изменяемыми ключами: если после добавления в
`HashSet` поменять поле, входящее в `hashCode`, объект останется в старой
корзине, а искать его будут в новой. Его нельзя ни найти, ни удалить — это
утечка памяти. Поэтому ключи хеш-коллекций должны быть неизменяемыми.

`equals` без `hashCode` ломает `HashSet`:
```java
static class Point {
    final int x, y;
    Point(int x, int y) { this.x = x; this.y = y; }
    @Override public boolean equals(Object o) {
        return o instanceof Point p && p.x == x && p.y == y;
    }
    // hashCode() НЕ переопределён
}
static final class FixedPoint {
    // те же поля и equals, плюс:
    @Override public int hashCode() { return Objects.hash(x, y); }
}
// main:
Set<Point> set = new HashSet<>();
set.add(new Point(1, 2));
System.out.println("equals без hashCode, contains: " + set.contains(new Point(1, 2)));
Set<FixedPoint> fixed = new HashSet<>();
fixed.add(new FixedPoint(1, 2));
System.out.println("equals + hashCode, contains:   " + fixed.contains(new FixedPoint(1, 2)));
```
```
equals без hashCode, contains: false
equals + hashCode, contains:   true
```
Объекты равны по `equals`, но `contains` возвращает `false`: поиск ушёл в
корзину, вычисленную по другому identity-хешу, и `equals` даже не вызывался.

#### IDE, Lombok и record
Писать `equals`/`hashCode` руками приходится редко. IDE генерирует их по
выбранным полям, `java.util.Objects.hash(...)` даёт однострочный `hashCode`,
Lombok `@EqualsAndHashCode` генерирует оба метода на этапе компиляции. `record`
(Java 16) генерирует `equals`, `hashCode` и `toString` по всем компонентам
автоматически — для классов-значений это сегодня основной вариант.

### clone() — зачем и почему считается неудачным API

#### Как работает clone()
`Object.clone()` — `protected native` метод, создающий побитовую копию объекта
без вызова конструктора. Он работает, только если класс реализует маркерный
интерфейс `Cloneable`, иначе бросает `CloneNotSupportedException`. Чтобы
клонирование было доступно снаружи, класс должен переопределить `clone()` как
`public`.

#### Поверхностная копия
Копия поверхностная (shallow): примитивные поля копируются, а ссылочные
указывают на те же объекты, что и в оригинале. Если в объекте есть
изменяемый список, оригинал и копия будут делить его. Глубокую копию нужно
делать вручную внутри переопределённого `clone()`, а это не работает с
`final`-полями — им нельзя присвоить новое значение после `super.clone()`.

`clone()` — поверхностная копия, а без `Cloneable` — исключение:
```java
static class Team implements Cloneable {
    String name;
    List<String> members = new ArrayList<>();
    Team(String name) { this.name = name; }
    @Override public Team clone() {
        try {
            return (Team) super.clone();       // поверхностная копия полей
        } catch (CloneNotSupportedException e) {
            throw new AssertionError(e);
        }
    }
    Team(Team other) {                         // copy-конструктор с глубокой копией списка
        this.name = other.name;
        this.members = new ArrayList<>(other.members);
    }
}
static class NotCloneable {
    Object tryClone() throws CloneNotSupportedException { return super.clone(); }
}
// main:
Team a = new Team("core");
a.members.add("Ann");
Team shallow = a.clone();
Team deep = new Team(a);
a.members.add("Bob");
System.out.println("shallow.members = " + shallow.members + ", same list: " + (shallow.members == a.members));
System.out.println("deep.members    = " + deep.members);
new NotCloneable().tryClone(); // перехвачено, печатаем исключение
```
```
shallow.members = [Ann, Bob], same list: true
deep.members    = [Ann]
без Cloneable: java.lang.CloneNotSupportedException: CloneDemo$NotCloneable
```
Клон делит список с оригиналом, поэтому `Bob` появился и в копии.
Copy-конструктор явно копирует список и даёт независимый объект — без
`Cloneable`, исключений и приведения типов.

#### Почему это «сломанный» механизм
Effective Java называет `Cloneable` сломанным API. Интерфейс не содержит
метода `clone()`, а лишь меняет поведение `protected`-метода `Object` —
нетипичное и неочевидное использование интерфейса. Объект создаётся без
конструктора, поэтому инварианты не проверяются, плюс checked-исключение,
которое никогда не должно возникать, и конфликт с `final`-полями.

На практике вместо `clone()` используют copy-конструктор (`new Team(other)`),
статическую фабрику копирования (`Team.copyOf(other)`) или билдер. Исключение
— массивы: у них `clone()` публичный и работает хорошо, но тоже поверхностно.

### wait()/notify()/notifyAll()

#### Методы монитора
`wait`, `notify` и `notifyAll` — `final native` методы, работающие с
intrinsic-монитором объекта, тем же, что захватывает `synchronized`. `wait()`
отпускает монитор и усыпляет поток до сигнала, `notify()` будит один ждущий
поток, `notifyAll()` — все. Они объявлены в `Object` именно потому, что
монитор есть у каждого объекта.

#### Только под монитором
Вызывать их можно только из кода, который уже удерживает монитор этого
объекта, то есть внутри `synchronized (obj)` или `synchronized`-метода. Иначе
— `IllegalMonitorStateException`. Правильный шаблон ожидания (`wait` в цикле
`while` из-за ложных пробуждений) и альтернативы из `java.util.concurrent`
разобраны в разделе 8.

`notify()` без захваченного монитора:
```java
Object lock = new Object();
try {
    lock.notify();                          // монитор не захвачен
} catch (IllegalMonitorStateException e) {
    System.out.println(e);
}
synchronized (lock) {
    lock.notify();                          // корректно: внутри synchronized
    System.out.println("notify() внутри synchronized — ок");
}
```
```
java.lang.IllegalMonitorStateException: current thread is not owner
notify() внутри synchronized — ок
```

### finalize() — устаревший и по факту не используемый механизм

#### Что обещал finalize
`finalize()` — метод, который сборщик мусора мог вызвать перед освобождением
памяти объекта, чтобы тот освободил внешние ресурсы. Проблема в том, что
момент вызова непредсказуем: он зависит от того, когда GC доберётся до
объекта, а JVM не гарантирует вызов вообще, например при завершении
программы.

#### Почему от него отказались
`finalize()` объявлен deprecated в Java 9, а в Java 18 (JEP 421) — deprecated
for removal. Объекты с финализатором дольше живут и замедляют GC, исключения
из `finalize` молча проглатываются. Кроме того, финализатор может «воскресить»
объект, сохранив `this` в статическое поле, а через финализатор
недоконструированного объекта возможна атака (finalizer attack).

#### Замена: try-with-resources и Cleaner
Для детерминированного освобождения ресурсов класс реализует `AutoCloseable`,
а вызывающий код использует try-with-resources — `close()` будет вызван ровно
при выходе из блока. Если нужна страховка на случай, когда `close()` забыли
вызвать, используют `java.lang.ref.Cleaner` (Java 9). Он регистрирует
действие очистки, которое выполнится после того, как объект стал недостижим,
и не имеет проблем `finalize`.

## Частые вопросы на собеседовании

**Q: Как ведут себя equals() и hashCode(), если их не переопределять?**
A: `equals` сравнивает ссылки, то есть объект равен только самому себе.
`hashCode` возвращает identity hash code — число, привязанное к объекту и
постоянное на всё время его жизни, но не адрес в памяти: в HotSpot оно
генерируется при первом запросе и хранится в заголовке объекта. Такое
поведение согласовано между собой и подходит для объектов-сущностей, где
важна идентичность, но не для классов-значений.

**Q: Почему если переопределён equals(), обязательно нужно переопределить и hashCode()?**
A: Контракт требует, чтобы равные объекты имели равные хеши. Хеш-коллекции
сначала выбирают корзину по `hashCode`, а `equals` вызывают только внутри
неё. Если хеши равных объектов разные, поиск уходит в другую корзину, и
`HashSet.contains` или `HashMap.get` не находят объект, хотя равный ему лежит
в коллекции.

**Q: Почему clone() считается неудачным решением в API Java?**
A: `Cloneable` — интерфейс без методов, который меняет поведение
`protected`-метода `Object`, что противоречит обычному смыслу интерфейсов.
`clone()` создаёт объект без конструктора, в обход инвариантов, делает
поверхностную копию, конфликтует с `final`-полями и требует обработки
checked-исключения, которое не должно возникать. Вместо него используют
copy-конструктор или статическую фабрику копирования.

**Q: Чем instanceof в equals отличается от getClass()?**
A: `instanceof` допускает равенство с наследниками и соблюдает принцип
подстановки, но не позволяет наследнику добавить значимое поле без
нарушения симметричности или транзитивности. `getClass()` сохраняет контракт,
но наследник без новых полей уже не равен родителю. Чистое решение — делать
классы-значения `final` или `record` и расширять их композицией.

**Q: Почему finalize() устарел и чем его заменить?**
A: Момент вызова непредсказуем, вызов не гарантирован, финализируемые
объекты замедляют GC, исключения проглатываются, объект можно «воскресить».
Для освобождения ресурсов используют `AutoCloseable` и try-with-resources, а
для страховки на случай забытого `close()` — `java.lang.ref.Cleaner`.

## Ловушки и частые ошибки

#### equals(Point) вместо equals(Object)
Метод с параметром конкретного типа не переопределяет `Object.equals`, а
перегружает его. Коллекции вызывают `equals(Object)` и получают сравнение
ссылок. `@Override` превращает эту ошибку в ошибку компиляции.

#### «hashCode — это адрес объекта»
Identity hash code не адрес: GC перемещает объекты при уплотнении памяти, а
хеш обязан оставаться прежним. Поэтому он вычисляется один раз и хранится в
заголовке объекта. Строку `Point@1b6d3586` нельзя использовать, чтобы судить о
расположении объекта в памяти.

#### Изменяемые поля в hashCode
Если `hashCode` зависит от изменяемого поля, объект, изменённый после
добавления в `HashSet` или использования ключом в `HashMap`, теряется в
коллекции и не удаляется — утечка памяти без единого исключения. Ключи
хеш-коллекций должны быть неизменяемыми или хотя бы не меняться, пока
лежат в коллекции.

Изменяемый ключ теряется в `HashSet`:
```java
static class Key {
    int id;
    Key(int id) { this.id = id; }
    @Override public boolean equals(Object o) { return o instanceof Key k && k.id == id; }
    @Override public int hashCode() { return Integer.hashCode(id); }
}
// main:
Set<Key> set = new HashSet<>();
Key k = new Key(1);
set.add(k);
k.id = 2;                                  // меняем поле, участвующее в hashCode
System.out.println("contains(k): " + set.contains(k));
System.out.println("size: " + set.size() + ", iterator видит: " + set.iterator().next().id);
set.remove(k);
System.out.println("после remove(k) size: " + set.size());
```
```
contains(k): false
size: 1, iterator видит: 2
после remove(k) size: 1
```
Объект лежит в множестве (итератор его видит), но ни `contains`, ни `remove`
его не находят: он остался в корзине для хеша `1`, а ищут его в корзине для
хеша `2`. Удалить такой элемент можно только через итератор или очисткой.

#### Массивы и equals
`arr1.equals(arr2)` для массивов — это `==`, унаследованное от `Object`. Два
массива с одинаковым содержимым не равны, и как ключ `HashMap` массив почти
бесполезен. Для сравнения содержимого — `Arrays.equals`, для вложенных
массивов — `Arrays.deepEquals`.

## Связанные темы
- [Наследование](02-inheritance.md) — почему equals с instanceof ломается при добавлении полей в наследнике.
- [Comparable и Comparator](07-comparable-comparator.md) — согласованность compareTo с equals.
- [Инкапсуляция](01-encapsulation.md) — record и неизменяемые классы-значения.
- [Map: HashMap изнутри](../05-collections/04-hashmap-internals.md) — как hashCode и equals используются при поиске.
- Взаимодействие потоков и deadlock (раздел 8) — wait/notify на практике.
- GC Roots, типы ссылок и утечки памяти (раздел 9) — Cleaner и фантомные ссылки.

## Источники
- Joshua Bloch, «Effective Java», 3rd ed.: Item 8 «Avoid finalizers and cleaners», Item 10 «Obey the general contract when overriding equals», Item 11 «Always override hashCode when you override equals», Item 12 «Always override toString», Item 13 «Override clone judiciously».
- [javadoc java.lang.Object](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Object.html).
- [JEP 421: Deprecate Finalization for Removal](https://openjdk.org/jeps/421).
