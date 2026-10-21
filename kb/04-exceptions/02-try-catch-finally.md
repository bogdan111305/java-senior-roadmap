---
title: "Механизм try-catch-finally"
section: 4
section_title: "Обработка исключений"
topic_slug: "04-02-try-catch-finally"
roadmap_ref: "Раздел 4 → Механизм try-catch-finally"
status: not-started
tags: [exceptions, try-catch-finally, try-with-resources, autocloseable, suppressed]
related:
  - "04-01-exception-hierarchy"
  - "04-03-custom-exceptions"
  - "09-08-bytecode-and-invokedynamic"
  - "16-01-jdbc-api"
last_reviewed: null
---

`try-catch-finally` пишут с первого дня, но вопросы «что вернёт метод с
`return` в `try` и в `finally`» и «в каком порядке закроются ресурсы»
регулярно ставят в тупик даже опытных разработчиков. За ними стоит конкретная
механика: когда выполняется `finally`, какое исключение доходит до вызывающего
кода и как `try-with-resources` не теряет ошибки закрытия.

## Ключевые концепции

### Порядок выполнения

#### finally выполняется всегда — почти
Блок `finally` выполняется при любом выходе из `try`: после нормального
завершения, после `return`, `break` и `continue` и после исключения — пойманного
или нет. Поэтому туда помещают освобождение ресурсов и снятие блокировок:
`lock.unlock()` в `finally` гарантирует, что блокировка не зависнет.

Исключения из правила связаны с тем, что поток или JVM перестают работать.
`System.exit()` и `Runtime.halt()` завершают JVM, не возвращаясь в `try`; так же
ведут себя `kill -9` и крах JVM. `finally` не выполнится и в бесконечном цикле
внутри `try`, и в daemon-потоке, который JVM просто бросает при завершении.

```java
static String normal() {
    try {
        System.out.println("  try: возвращаем \"из try\"");
        return "из try";
    } finally {
        System.out.println("  finally: выполняется перед выходом из метода");
    }
}

static void failing() {
    try {
        throw new IllegalStateException("ошибка в try");
    } finally {
        System.out.println("  finally: выполняется и при исключении");
    }
}
// ...
System.out.println("1. normal() вернул: " + normal());
failing();   // исключение перехвачено снаружи
```
```
  try: возвращаем "из try"
  finally: выполняется перед выходом из метода
1. normal() вернул: из try
  finally: выполняется и при исключении
1. failing() бросил: ошибка в try
```
`return` не выходит из метода сразу: сначала отрабатывает `finally`, и только
потом значение возвращается вызывающему. Исключение тоже «ждёт» `finally` и
лишь затем летит дальше.

А вот `System.exit` не оставляет `finally` шанса:
```java
try {
    System.out.println("try: вызываем System.exit(0)");
    System.exit(0);
} finally {
    System.out.println("finally: эта строка не напечатается");
}
```
```
try: вызываем System.exit(0)
```
JVM начала завершаться прямо внутри `try`. Shutdown hooks при этом выполнятся,
а `finally` — нет.

#### return в finally перекрывает try
Если `finally` завершается «внезапно» — через `return` или `throw`, — его
результат заменяет всё, что произошло в `try`. `return` в `finally`
перекрывает `return` из `try` и, что хуже, молча отменяет брошенное в `try`
исключение. Компилятор с `-Xlint:finally` предупреждает: `finally clause
cannot complete normally`.

```java
static int overridesReturn() {
    try {
        return 1;
    } finally {
        return 2;
    }
}

static String swallowsException() {
    try {
        throw new IllegalStateException("важная ошибка");
    } finally {
        return "всё хорошо";
    }
}
```
```
2. return 1 в try, return 2 в finally: 2
2. исключение в try, return в finally: всё хорошо
```
Во втором случае `IllegalStateException` бесследно исчез: ни в логах, ни у
вызывающего кода его не будет. Поэтому `return` и `throw` в `finally` считают
ошибкой.

Значение из `return` в `try` вычисляется и сохраняется до выполнения
`finally`. Для примитива изменение переменной в `finally` уже ничего не
меняет, а для объекта меняется сам объект, ссылку на который вернут:
```java
static int primitiveSaved() {
    int x = 1;
    try {
        return x;
    } finally {
        x = 2;   // возвращаемое значение уже сохранено
    }
}

static StringBuilder objectMutated() {
    StringBuilder sb = new StringBuilder("из try");
    try {
        return sb;
    } finally {
        sb.append(" + из finally");   // меняем тот же объект
    }
}
```
```
3. int x = 1, в finally x = 2: 1
3. StringBuilder, append в finally: из try + из finally
```
Сохранена копия значения `x`, поэтому вернулась единица. Для `StringBuilder`
сохранена копия ссылки, и изменение объекта через неё видно.

#### Несколько catch: от частного к общему
Блоки `catch` проверяются сверху вниз, и срабатывает первый, чей тип подходит.
Поэтому более специфичные исключения ставят выше общих. Обратный порядок —
ошибка компиляции: `catch` подкласса после `catch` суперкласса недостижим.

```java
try {
    new FileReader("data.txt").close();
} catch (IOException e) {
    System.out.println("общая ошибка ввода-вывода");
} catch (FileNotFoundException e) {          // недостижимо: уже поймано выше
    System.out.println("файл не найден");
}
```
```
CatchOrder.java:11: error: exception FileNotFoundException has already been caught
        } catch (FileNotFoundException e) {
          ^
```
`FileNotFoundException` — наследник `IOException`, и первый `catch` уже
перехватывает его.

С Java 7 одинаковую обработку для разных типов объединяют в multi-catch:
`catch (IOException | SQLException e)`. Параметр такого `catch` неявно `final`,
а альтернативы не должны быть связаны наследованием — иначе одна поглощает
другую:
```java
} catch (FileNotFoundException | IOException e) {   // подкласс и суперкласс в одном multi-catch
```
```
CatchOrder.java:19: error: Alternatives in a multi-catch statement cannot be related by subclassing
        } catch (FileNotFoundException | IOException e) {
                                         ^
  Alternative FileNotFoundException is a subclass of alternative IOException
```
Достаточно оставить `IOException`: он и так покрывает оба случая.

### try-with-resources

#### AutoCloseable и автоматический close()
`try-with-resources` (Java 7) закрывает ресурсы автоматически: любой объект,
реализующий `AutoCloseable`, объявленный в скобках после `try`, получит вызов
`close()` при любом выходе из блока. `Closeable` из `java.io` — его
наследник, у которого `close()` бросает `IOException` и по контракту
идемпотентен: повторный вызов ничего не делает.

С Java 9 в скобках можно указать и уже созданную переменную, если она `final`
или effectively final: `try (connection) { ... }`. Это удобно, когда ресурс
создаётся заранее или передан параметром.

```java
static class Resource implements AutoCloseable {
    private final String name;
    private final boolean failOnClose;
    Resource(String name, boolean failOnClose) {
        this.name = name;
        this.failOnClose = failOnClose;
        System.out.println("  открыт " + name);
    }
    @Override
    public void close() {
        System.out.println("  закрыт " + name);
        if (failOnClose) throw new IllegalStateException("ошибка закрытия " + name);
    }
}
// ...
Resource external = new Resource("C", false);
try (external) {
    System.out.println("  работаем с C");
}
```
```
  открыт C
  работаем с C
  закрыт C
```
`close()` вызвался без явного кода в `finally`. Тот же класс `Resource`
используется в примерах ниже.

#### Порядок закрытия ресурсов
Ресурсы закрываются в порядке, обратном объявлению: последний открытый —
первым закрытый. Это естественно для зависимых ресурсов: `ResultSet` должен
закрыться раньше `Statement`, а тот — раньше `Connection`. Если упал
конструктор второго ресурса, первый, уже открытый, всё равно будет закрыт.

Важная деталь — момент закрытия. Ресурсы закрываются сразу при выходе из
тела `try`, до того как выполнятся `catch` и `finally`. В `catch` ресурс уже
недоступен и закрыт.

```java
try (Resource a = new Resource("A", false);
     Resource b = new Resource("B", false)) {
    System.out.println("  тело try");
    throw new IllegalStateException("ошибка в теле");
} catch (IllegalStateException e) {
    System.out.println("  catch: " + e.getMessage());
} finally {
    System.out.println("  finally");
}
```
```
  открыт A
  открыт B
  тело try
  закрыт B
  закрыт A
  catch: ошибка в теле
  finally
```
`B` закрылся раньше `A`, и оба — до входа в `catch`.

#### Подавленные исключения
Если тело `try` бросило исключение и `close()` тоже бросил, какое из них
важнее? `try-with-resources` отвечает: основное — из тела, а ошибки закрытия
прикрепляются к нему через `addSuppressed` и доступны через `getSuppressed()`.
В стектрейсе они печатаются отдельными блоками `Suppressed:`.

```java
try (Resource a = new Resource("A", true);
     Resource b = new Resource("B", true)) {
    throw new IllegalStateException("ошибка в теле");
} catch (IllegalStateException e) {
    System.out.println("  основное: " + e.getMessage());
    for (Throwable s : e.getSuppressed()) System.out.println("  suppressed: " + s.getMessage());
}
```
```
  открыт A
  открыт B
  закрыт B
  закрыт A
  основное: ошибка в теле
  suppressed: ошибка закрытия B
  suppressed: ошибка закрытия A
```
До вызывающего кода дошли все три ошибки, причём главная — первой.

Ручной `try/finally` так не умеет: исключение из `finally` заменяет исходное.
```java
Resource a = new Resource("A", true);
try {
    throw new IllegalStateException("ошибка в теле");
} finally {
    a.close();
}
```
```
  открыт A
  закрыт A
  дошло: ошибка закрытия A, suppressed: []
```
Настоящая причина сбоя — «ошибка в теле» — потеряна, а в логах окажется лишь
вторичная ошибка закрытия. Это главный практический довод в пользу
`try-with-resources`.

## Как это работает «под капотом»
В байткоде нет инструкций `try` и `catch`. У метода есть таблица исключений
(exception table): каждая строка говорит «если в диапазоне инструкций
`from`–`to` возникло исключение типа `type`, перейти на `target`». При
исключении JVM ищет подходящую строку в текущем методе, а если не находит —
снимает кадр стека и повторяет поиск у вызывающего.

`finally` отдельной конструкцией тоже не существует: компилятор копирует его код
в каждый путь выхода. Метод с `try`, одним `catch` и `finally`:
```java
static int parse(String s) {
    try {
        return Integer.parseInt(s);
    } catch (NumberFormatException e) {
        return -1;
    } finally {
        System.out.println("finally");
    }
}
```
```
static int parse(java.lang.String);
    Code:
       0: aload_0
       1: invokestatic  #7      // Method java/lang/Integer.parseInt:(Ljava/lang/String;)I
       4: istore_1
       5: getstatic     #13     // Field java/lang/System.out:Ljava/io/PrintStream;
       8: ldc           #19     // String finally
      10: invokevirtual #21     // Method java/io/PrintStream.println:(Ljava/lang/String;)V
      13: iload_1
      14: ireturn
      15: astore_1
      16: iconst_m1
      17: istore_2
      18: getstatic     #13     // Field java/lang/System.out:Ljava/io/PrintStream;
      21: ldc           #19     // String finally
      23: invokevirtual #21     // Method java/io/PrintStream.println:(Ljava/lang/String;)V
      26: iload_2
      27: ireturn
      28: astore_3
      29: getstatic     #13     // Field java/lang/System.out:Ljava/io/PrintStream;
      32: ldc           #19     // String finally
      34: invokevirtual #21     // Method java/io/PrintStream.println:(Ljava/lang/String;)V
      37: aload_3
      38: athrow
    Exception table:
       from    to  target type
           0     5    15   Class java/lang/NumberFormatException
           0     5    28   any
          15    18    28   any
```
`println("finally")` встречается трижды: на выходе из `try` (5–10), из `catch`
(18–23) и на пути необработанного исключения (29–34), который заканчивается
`athrow`. Видно и сохранение результата: `istore_1` кладёт значение в
локальную переменную до `finally`, а `iload_1` возвращает его после — отсюда
поведение примера с `x = 2`.

`try-with-resources` тоже разворачивается компилятором в обычные `try/catch`
с вызовами `close()` и `addSuppressed()`. Поэтому `javap` показывает для него
заметно больше кода, чем видно в исходнике.

## Частые вопросы на собеседовании

**Q: Что вернёт метод, если return есть и в try, и в finally?**
A: Значение из `finally`. Сначала вычисляется и сохраняется значение из `try`,
затем выполняется `finally`, и его `return` перекрывает сохранённое. Если в `try`
было исключение, `return` в `finally` его отменит — поэтому так не пишут, а
`javac -Xlint:finally` об этом предупреждает.

**Q: Когда finally не выполняется?**
A: Когда поток или JVM прекращают работу, не возвращаясь в `try`:
`System.exit()`, `Runtime.halt()`, `kill -9`, крах JVM. Также — если `try`
никогда не завершается (бесконечный цикл) или если это daemon-поток, а JVM
завершилась. При обычном `return`, `break` и любом исключении `finally`
выполняется.

**Q: В каком порядке try-with-resources закрывает ресурсы и когда?**
A: В обратном порядке объявления: последний объявленный закрывается первым. Закрытие
происходит сразу при выходе из тела `try` — до блоков `catch` и `finally`. Если
упал конструктор одного из ресурсов, уже открытые всё равно закрываются.

**Q: Что такое suppressed-исключения?**
A: Это исключения, которые возникли при закрытии ресурсов, пока уже летело
основное исключение из тела `try`. Они не заменяют основное, а прикрепляются к
нему через `addSuppressed` и доступны через `getSuppressed()`. В ручном
`try/finally` исключение из `finally` заменило бы исходное, и причина сбоя
потерялась бы.

**Q: Почему catch подкласса нельзя поставить после catch суперкласса?**
A: Блоки `catch` проверяются по порядку, и суперкласс перехватит все свои
подклассы раньше. Блок подкласса стал бы недостижимым, поэтому компилятор
считает это ошибкой. В multi-catch по той же причине нельзя объединять типы,
связанные наследованием.

## Ловушки и частые ошибки

#### return и throw в finally
`return` в `finally` перекрывает результат `try` и молча отменяет исключение;
`throw` в `finally` заменяет исходное исключение новым. В обоих случаях реальная
причина сбоя исчезает. В `finally` пишут только освобождение ресурсов, которое
само не должно бросать.

#### Ручное закрытие ресурсов в finally
Классический код до Java 7 — `finally { if (rs != null) rs.close(); if (st !=
null) st.close(); }` — ошибочен дважды. Исключение из первого `close()` не даст
закрыть остальные ресурсы, а заодно заменит исходное исключение. `try-with-resources`
решает обе проблемы.

#### Обращение к ресурсу в catch
Ресурс из `try (...)` в `catch` уже закрыт — и вне области видимости. Если в
обработчике нужна информация из ресурса (например, номер строки файла), её
сохраняют в переменную заранее.

#### finally как гарантия при завершении JVM
Код вида «запишем статистику в `finally`» не сработает при `System.exit()` или
остановке контейнера через `SIGKILL`. Для корректного завершения используют
shutdown hooks и graceful shutdown фреймворка, а данные, потеря которых
недопустима, сохраняют сразу, а не «на выходе».

## Связанные темы
- [Иерархия исключений](01-exception-hierarchy.md) — какие исключения перехватывает тот или иной `catch`.
- [Свои исключения и best practices](03-custom-exceptions.md) — цепочки причин и логирование перехваченных ошибок.
- [Установка окружения и первая программа](../02-java-core/01-environment-setup.md) — `javap`, которым смотрят таблицу исключений.
- Байткод, invokedynamic и Instrumentation API (раздел 9) — подробнее об устройстве байткода.
- JDBC API и драйвер (раздел 16) — `Connection`, `Statement` и `ResultSet` в `try-with-resources`.

## Источники
- [JLS §14.20: The try statement](https://docs.oracle.com/javase/specs/jls/se21/html/jls-14.html#jls-14.20), включая §14.20.3 try-with-resources.
- [JVMS §3.12: Throwing and Handling Exceptions](https://docs.oracle.com/javase/specs/jvms/se21/html/jvms-3.html#jvms-3.12) и §3.13 «Compiling finally» — таблица исключений и компиляция `finally`.
- [javadoc java.lang.AutoCloseable](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/AutoCloseable.html).
- Joshua Bloch, «Effective Java», 3rd ed.: Item 9 «Prefer try-with-resources to try-finally».
