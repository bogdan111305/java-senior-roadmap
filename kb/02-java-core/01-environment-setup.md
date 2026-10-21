---
title: "Установка окружения и первая программа"
section: 2
section_title: "Java Core: синтаксис и базовые конструкции"
topic_slug: "02-01-environment-setup"
roadmap_ref: "Раздел 2 → Установка окружения и первая программа"
status: not-started
tags: [jdk, jre, jvm, tooling, ide, debug, jshell]
related:
  - "01-01-os-basics"
  - "09-01-jvm-architecture"
  - "09-02-classloading"
  - "10-02-java-9-11"
  - "14-01-maven"
last_reviewed: null
---

Формально это самая простая тема раздела, но именно на ней проверяют, понимает
ли кандидат разницу между JDK, JRE и JVM и что происходит между файлом `.java` и
запущенным процессом. Путаница в этих понятиях сразу выдаёт поверхностные
знания на senior-уровне.

## Ключевые концепции

### Инструменты

#### JDK, JRE и JVM
Когда говорят «поставь Java», имеют в виду одно из трёх понятий, которые часто
путают. JVM (Java Virtual Machine) исполняет байткод: это абстрактная машина с
конкретными реализациями — HotSpot в OpenJDK, а также GraalVM и OpenJ9.

JRE (Java Runtime Environment) — это JVM плюс стандартная библиотека классов
(`java.lang`, `java.util` и так далее), то есть всё, что нужно для запуска уже
скомпилированных программ. JDK (Java Development Kit) — это JRE плюс инструменты
разработки: компилятор `javac`, отладчик `jdb`, упаковщик `jar`, дизассемблер
`javap`, `jshell`, `jlink` и другие.

С Java 11 Oracle перестала выпускать JRE отдельным пакетом, и сегодня почти
везде ставят JDK целиком. Для маленьких образов вместо JRE собирают
урезанный рантайм под конкретное приложение командой `jlink`. Само деление
JDK/JRE стало скорее историческим, но на собеседовании о нём спрашивают как о
базовой модели платформы.

```
$ java -version
openjdk version "21.0.10" 2026-01-20 LTS
OpenJDK Runtime Environment Temurin-21.0.10+7 (build 21.0.10+7-LTS)
OpenJDK 64-Bit Server VM Temurin-21.0.10+7 (build 21.0.10+7-LTS, mixed mode, sharing)
$ javac -version
javac 21.0.10
```
`java -version` называет рантайм и реализацию JVM (здесь HotSpot в сборке
Temurin), а `javac -version` — компилятор, который есть только в JDK. Если
первая команда работает, а вторая — «команда не найдена», на машине стоит
только рантайм: запускать программы можно, компилировать — нет.

#### Дистрибутивы и версии JDK
OpenJDK — исходный код платформы, а собирают его разные вендоры: Eclipse
Temurin, Amazon Corretto, Azul Zulu, BellSoft Liberica, Microsoft Build of
OpenJDK, Oracle JDK. Функционально они почти одинаковы, различаются лицензией,
сроками поддержки и дополнительными компонентами.

Новая версия Java выходит раз в полгода, а каждая четвёртая — LTS с долгой
поддержкой: 8, 11, 17, 21 и 25 (сентябрь 2025). В проде обычно используют LTS,
а на собеседовании ожидают знать, что появилось в 17, 21 и 25 (раздел 10).
Несколько JDK на одной машине удобно держать через SDKMAN!, менеджер версий в
IDE или toolchains в Maven и Gradle.

#### JAVA_HOME и переменная PATH
Чтобы `javac` и `java` вызывались из любой директории, используют две
переменные окружения. `JAVA_HOME` указывает на корень JDK (например,
`/usr/lib/jvm/java-21-openjdk`), и по нему Maven и Gradle выбирают, каким JDK
собирать проект. В `PATH` добавляют `$JAVA_HOME/bin`, чтобы команды находились
без полного пути.

Несовпадение версий в `JAVA_HOME` и `PATH` — частая причина, когда `mvn -v` и
`java -version` в одном терминале показывают разные версии Java. Сборка при
этом идёт одним JDK, а запуск — другим.

```
$ echo $JAVA_HOME
/c/Users/dev/.jdks/temurin-17.0.17
$ java -version
openjdk version "21.0.10" 2026-01-20 LTS
$ mvn -v | grep "Java version"
Java version: 17.0.17, vendor: Eclipse Adoptium, runtime: C:\Users\dev\.jdks\temurin-17.0.17
```
В `PATH` первым стоит JDK 21 — его видит `java -version`. А Maven берёт JDK из
`JAVA_HOME` и собирает проект на Java 17. Лечится тем, что `JAVA_HOME` и
`PATH` настраивают на один и тот же JDK.

#### javac, java и запуск из исходника
Базовый цикл разработки двухшаговый: `javac` компилирует исходный код в байткод
(`.class`-файлы), а `java` запускает JVM, которая этот байткод исполняет.
Байткод не зависит от процессора: JVM сначала интерпретирует его, а горячие
участки JIT-компилирует в машинный код (раздел 9). Отсюда лозунг «write once,
run anywhere».

С Java 11 можно запускать однофайловую программу прямо из исходника: `java
Main.java` компилирует файл в памяти и сразу исполняет, не оставляя
`Main.class` на диске. С Java 22 (JEP 458) так же запускается программа из
нескольких файлов: недостающие классы `java` ищет в соседних исходниках.

Классический двухшаговый цикл:
```java
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, Java!");
    }
}
```
```bash
javac Main.java
java Main
```
```
Hello, Java!
```
`javac` создал рядом файл `Main.class`, а `java Main` запустил JVM, которая
нашла его по имени класса через classpath (по умолчанию — текущая директория)
и вызвала `main`.

Что внутри `Main.class`, показывает дизассемблер:
```bash
javap -c Main
```
```
Compiled from "Main.java"
public class Main {
  public Main();
    Code:
       0: aload_0
       1: invokespecial #1    // Method java/lang/Object."<init>":()V
       4: return

  public static void main(java.lang.String[]);
    Code:
       0: getstatic     #7    // Field java/lang/System.out:Ljava/io/PrintStream;
       3: ldc           #13   // String Hello, Java!
       5: invokevirtual #15   // Method java/io/PrintStream.println:(Ljava/lang/String;)V
       8: return
}
```
Даже в классе без явного конструктора компилятор сгенерировал пустой `public
Main()`, вызывающий конструктор `Object`. Этот конструктор по умолчанию
разобран в теме «Классы и объекты».

Запуск из исходника без явной компиляции:
```bash
rm Main.class
java Main.java
```
```
Hello, Java!
```
Результат тот же, но `Main.class` на диске не появился: компиляция прошла в
памяти. При каждом запуске она выполняется заново.

Программа из двух файлов в одной папке — `Main.java` вызывает `Helper.greet()`
из `Helper.java`:
```
$ java Main.java          # Java 25
Helper.greet() из соседнего файла

$ java Main.java          # Java 21
Main.java:3: error: cannot find symbol
        System.out.println(Helper.greet());
                           ^
  symbol:   variable Helper
```
На Java 21 запуск из исходника видит только один файл. С Java 22 (JEP 458)
launcher находит недостающий класс в соседнем `Helper.java` и компилирует его
сам.

#### Компактные исходники и main без класса (Java 25)
В Java 25 (JEP 512) для небольших программ разрешены компактные исходные файлы:
можно написать `void main()` без объявления класса и без `public static`.
Компилятор сам оборачивает такой файл в неявный класс. Для вывода появился
класс `java.lang.IO` с методами `IO.println` и `IO.readln`.

Это упрощение для обучения и скриптов, а не новый стиль для промышленного
кода. На Java 21 тот же файл не скомпилируется без `--enable-preview`: там эта
возможность была предварительной (preview).

```java
void main() {
    IO.println("Привет из Java 25: без класса и без public static");
}
```
```
$ java Hello25.java       # Java 25
Привет из Java 25: без класса и без public static

$ java Hello25.java       # Java 21
Hello25.java:1: error: unnamed classes are a preview feature and are disabled by default.
void main() {
^
  (use --enable-preview to enable unnamed classes)
```
В Java 21 эта возможность называлась unnamed classes и была preview. В Java 25
она финализирована под названием compact source files.

#### jshell
`jshell` (Java 9) — интерактивная оболочка (REPL), где выражения выполняются
сразу, без класса и метода `main`. Её удобно использовать для быстрой проверки
API, регулярного выражения или формата даты. Команды оболочки начинаются со
слеша: `/vars`, `/methods`, `/imports`, `/exit`.

```
$ cat demo.jsh
int x = 2 + 3;
System.out.println(x * 10);
/exit
$ jshell demo.jsh
50
```
`jshell` выполнил строки скрипта без класса и `main`, а `/exit` завершил
сессию — без него оболочка осталась бы в интерактивном режиме.

#### Версия байткода и флаг --release
Каждый `.class`-файл содержит версию формата: Java 17 — это 61, Java 21 — 65,
Java 25 — 69. JVM отказывается загружать класс, скомпилированный под более
новую версию, с ошибкой `UnsupportedClassVersionError`.

Чтобы собрать код под старую JVM новым компилятором, используют флаг `javac
--release N`. Он задаёт и версию байткода, и набор доступного API: компилятор
не даст вызвать метод, которого в Java N ещё нет. Старая пара `-source` и
`-target` такой проверки API не делает, поэтому `--release` предпочтительнее.

Магическое число и версия байткода:
```bash
javac Main.java
od -A x -t x1z Main.class | head -3
```
```
000000 ca fe ba be 00 00 00 41 00 1d 0a 00 02 00 03 07  >.......A........<
000010 00 04 0c 00 05 00 06 01 00 10 6a 61 76 61 2f 6c  >..........java/l<
000020 61 6e 67 2f 4f 62 6a 65 63 74 01 00 06 3c 69 6e  >ang/Object...<in<
```
Первые четыре байта любого `.class`-файла — магическое число `CAFEBABE`, по
которому JVM опознаёт формат. Следующие два 16-битных числа — minor и major
версия: `0x41` = 65, то есть Java 21 (major = 44 + номер версии Java).

Класс, собранный JDK 21, на JVM 17:
```
$ javac V.java                       # JDK 21
$ java V                             # JRE 17
Error: LinkageError occurred while loading main class V
	java.lang.UnsupportedClassVersionError: V has been compiled by a more recent version of the Java Runtime (class file version 65.0), this version of the Java Runtime only recognizes class file versions up to 61.0

$ javac --release 17 V.java          # JDK 21
$ java V                             # JRE 17
запущено на Java 17.0.17
```
Сообщение называет обе версии: класс 65.0 (Java 21), рантайм понимает до 61.0
(Java 17). С `--release 17` тот же компилятор выдал байткод, который Java 17
загружает без ошибок.

### IDE и проект

#### Структура Maven/Gradle-проекта
Реальные проекты почти никогда не компилируют вручную через `javac` — это
делает система сборки, и стандартом стали Maven и Gradle (раздел 14). Оба
задают предсказуемую структуру каталогов: код в `src/main/java`, ресурсы
(конфиги, статика) в `src/main/resources`, тесты в `src/test/java` и
`src/test/resources`.

Такое единообразие — не вкусовщина. IDE, плагины и CI одинаково понимают, где
искать код в любом Maven- или Gradle-проекте, независимо от того, кто его
писал.

```
my-app/
├── pom.xml
└── src/
    ├── main/
    │   ├── java/com/example/Main.java
    │   └── resources/application.properties
    └── test/
        ├── java/com/example/MainTest.java
        └── resources/application-test.properties
```
Тесты лежат в том же пакете `com.example`, но в отдельном дереве: в итоговый
`.jar` попадает только `src/main`, а тестовый код и его ресурсы в продакшен не
уходят.

#### Classpath, .class-файлы и модули
На этапе запуска JVM ищет нужные `.class`-файлы по classpath — списку
директорий и `.jar`-архивов. Если класс не найден, возникает
`ClassNotFoundException` (класс не нашли при явной загрузке по имени) или
`NoClassDefFoundError` (класс был доступен при компиляции, но в момент
исполнения его не удалось загрузить или инициализировать — подробнее в
ловушках ниже).

С Java 9 появилась модульная система JPMS (`module-info.java`, раздел 10) —
более строгий механизм поверх classpath. Модуль явно объявляет, какие пакеты
он экспортирует наружу и от каких модулей зависит.

Опечатка в имени главного класса и пропавшая зависимость дают разные ошибки.
Здесь `Main` вызывает `Helper.greet()`, оба класса скомпилированы в `out/`:
```
$ java -cp out com.example.Main
Error: Could not find or load main class com.example.Main
Caused by: java.lang.ClassNotFoundException: com.example.Main

$ java -cp out Main
Helper на месте
$ rm out/Helper.class
$ java -cp out Main
Exception in thread "main" java.lang.NoClassDefFoundError: Helper
	at Main.main(Main.java:3)
Caused by: java.lang.ClassNotFoundException: Helper
```
В первом случае launcher сам ищет класс по имени и не находит — это
`ClassNotFoundException`. Во втором `Main` скомпилирован со ссылкой на
`Helper`, но к моменту исполнения его нет — `NoClassDefFoundError` с
`ClassNotFoundException` в причине. Так же выглядит `.jar` зависимости,
забытый в classpath при запуске.

### Отладка в IDE

#### Breakpoint и пошаговое выполнение
Основной инструмент разбора логики на месте — точка останова (breakpoint):
отметка на строке, при достижении которой JVM приостанавливает поток и отдаёт
управление отладчику. Дальше доступно пошаговое выполнение.

Step Over выполняет текущую строку целиком, не заходя в вызываемые методы.
Step Into заходит внутрь вызываемого метода, а Step Out дорабатывает текущий
метод и возвращает в место вызова. Различие Over и Into экономит время: если
баг точно не в библиотечном коде, Step Over избавляет от блуждания по нему.

#### Conditional и logging breakpoint
Обычный breakpoint останавливает поток при каждом проходе строки, что
бесполезно, если баг проявляется на пятисотой итерации цикла. Conditional
breakpoint останавливает только при истинном условии, например `i == 42`, без
временного `if` в коде.

Logging breakpoint (в IntelliJ IDEA — «Evaluate and log») вообще не
останавливает поток, а пишет в консоль выражение при каждом проходе. Это
замена `System.out.println`, которую не нужно потом вычищать из кода.

#### Watches и Evaluate Expression
Во время остановки доступны Watches — выражения, значения которых IDE
показывает при каждой остановке, например поле объекта или элемент коллекции.
Evaluate Expression позволяет выполнить произвольное выражение или вызвать
метод в контексте остановленной программы. Так можно проверить гипотезу вроде
«а что вернёт `list.contains(x)`» без изменения кода.

#### Remote debug
Те же механизмы работают и с JVM, запущенной на другой машине, — это remote
debug. Целевую JVM запускают с агентом JDWP (Java Debug Wire Protocol), который
открывает порт для отладчика, а IDE подключается к нему по сети. Так отлаживают
сервис, баг которого не воспроизводится локально, например в контейнере на
staging.

Типичная строка запуска — `-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005`.
`suspend=y` заставит JVM ждать подключения отладчика до старта `main`, что
удобно для отладки инициализации. С Java 9 `address=5005` слушает только
localhost, а `*:5005` открывает порт для всех интерфейсов. Отладочный порт даёт
полный контроль над процессом, поэтому в проде его не открывают.

```
$ java -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005 W.java
Listening for transport dt_socket at address: 5005
```
`server=y` значит, что JVM сама открывает порт и ждёт отладчик, а не
подключается к нему. Первой строкой она сообщает этот порт — к нему
подключается IDE в конфигурации Remote JVM Debug.

## Частые вопросы на собеседовании

**Q: В чём разница между JDK, JRE и JVM?**
A: JVM исполняет байткод и существует в нескольких реализациях (HotSpot,
GraalVM, OpenJ9). JRE — это JVM плюс стандартная библиотека, достаточная для
запуска готовых программ. JDK — это JRE плюс инструменты разработки: `javac`,
`jar`, `javap`, `jshell`, `jlink`. С Java 11 отдельную JRE не выпускают — ставят
JDK, а компактный рантайм под приложение собирают через `jlink`.

**Q: Что происходит между `javac Main.java` и выводом в консоли?**
A: `javac` компилирует исходник в байткод — файл `Main.class` с магическим
числом `CAFEBABE` и версией формата. `java Main` запускает JVM, которая находит
класс по classpath, загружает его через ClassLoader, проверяет байткод и
вызывает `main`. Сначала байткод интерпретируется, а горячие участки
JIT-компилятор переводит в машинный код во время работы (раздел 9).

**Q: Что значит `UnsupportedClassVersionError` и как его исправить?**
A: Класс скомпилирован под более новую версию Java, чем JVM, на которой его
запускают: в сообщении видны обе версии формата (например, 65 и 61). Решения —
запускать на нужной JVM или собирать код с `javac --release N` под целевую
версию. В Maven и Gradle это настройка `release` компилятора или toolchain.

**Q: Чем conditional breakpoint отличается от обычного и когда он нужен?**
A: Обычный breakpoint останавливает поток при каждом проходе строки, а
conditional — только когда условие истинно, например `orderId == 12345`. Это
незаменимо, когда баг проявляется на конкретной итерации большого цикла или на
конкретном значении среди тысяч.

## Ловушки и частые ошибки

#### «JRE исчезла» после Java 11
Исчезла не концепция, а отдельный дистрибутив. Сама JRE как «JVM +
стандартная библиотека» никуда не делась: Oracle и большинство вендоров просто
перестали собирать её отдельно, и ставят JDK целиком.

#### Запуск из исходника — не интерпретация
`java Main.java` не делает Java скриптовым языком. Компиляция в байткод
происходит, просто внутри одной команды и без сохранения `.class` на диск — и
повторяется при каждом запуске.

#### ClassNotFoundException vs NoClassDefFoundError
Это разные по природе и по типу (`Exception` и `Error`) ситуации.
`ClassNotFoundException` возникает, когда код сам загружает класс по имени
(`Class.forName`, рефлексия) и не находит его. `NoClassDefFoundError` — когда
класс был доступен при компиляции, но JVM не может получить его в момент
исполнения.

У `NoClassDefFoundError` две типичные причины. Первая — класса физически нет:
`.jar` с зависимостью не попал в classpath при запуске (пример в разделе про
classpath выше). Вторая, о которой часто забывают, — класс на месте, но его
статическая инициализация упала.

Во втором случае первое обращение к классу бросает
`ExceptionInInitializerError` с настоящей причиной внутри, а JVM помечает класс
как непригодный. Все последующие обращения получают `NoClassDefFoundError:
Could not initialize class ...` уже без исходной причины. Поэтому при таком
сообщении нужно искать в логах самое первое `ExceptionInInitializerError`, а не
проверять classpath:
```java
public class Ncdfe {
    static class Config {
        static final int PORT = Integer.parseInt("not-a-number"); // падает при инициализации класса
    }
    public static void main(String[] args) {
        for (int i = 1; i <= 2; i++) {
            try {
                System.out.println(Config.PORT);
            } catch (Throwable t) {
                System.out.println("попытка " + i + ": " + t);
            }
        }
    }
}
```
```
попытка 1: java.lang.ExceptionInInitializerError
попытка 2: java.lang.NoClassDefFoundError: Could not initialize class Ncdfe$Config
```

#### Открытый отладочный порт
Флаг `address=*:5005` в продовой конфигурации — серьёзная дыра: через JDWP
можно выполнить произвольный код в процессе. Удалённую отладку включают только
на тестовых стендах и, если нужно, пробрасывают порт через SSH-туннель или
`kubectl port-forward`, а не открывают в сеть.

## Связанные темы
- [Как устроен компьютер и операционная система](../01-fundamentals/01-os-basics.md) — процессы и системные вызовы, на которых в конечном счёте работает JVM.
- [Классы и объекты](09-classes-and-objects.md) — конструктор по умолчанию, который видно в `javap`.
- Архитектура JVM и загрузка классов (раздел 9) — что происходит с байткодом после того, как JVM нашла `.class`-файл.
- Java 9–11 (раздел 10) — JPMS, jshell и запуск из исходника.
- Maven (раздел 14) — то, что на практике заменяет ручной вызов `javac` и `java`.

## Источники
- [JEP 330: Launch Single-File Source-Code Programs](https://openjdk.org/jeps/330), [JEP 458: Launch Multi-File Source-Code Programs](https://openjdk.org/jeps/458).
- [JEP 512: Compact Source Files and Instance Main Methods](https://openjdk.org/jeps/512).
- [JEP 222: jshell](https://openjdk.org/jeps/222), [JEP 247: Compile for Older Platform Versions (--release)](https://openjdk.org/jeps/247).
- [Java Virtual Machine Specification, глава 4: The class File Format](https://docs.oracle.com/javase/specs/jvms/se21/html/jvms-4.html).
- [JPDA Connection and Invocation Details](https://docs.oracle.com/en/java/javase/21/docs/specs/jpda/conninv.html) — параметры агента JDWP.
