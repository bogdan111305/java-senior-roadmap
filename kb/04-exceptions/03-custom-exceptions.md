---
title: "Свои исключения и best practices"
section: 4
section_title: "Обработка исключений"
topic_slug: "04-03-custom-exceptions"
roadmap_ref: "Раздел 4 → Свои исключения и best practices"
status: not-started
tags: [exceptions, custom-exceptions, exception-chaining, logging, best-practices]
related:
  - "04-01-exception-hierarchy"
  - "04-02-try-catch-finally"
  - "04-04-exceptions-in-concurrency"
  - "27-01-logging"
  - "18-07-spring-transactions"
  - "09-06-jit-compilation"
last_reviewed: null
---

Свои исключения пишут в каждом проекте, и по ним хорошо видно уровень команды:
сохраняется ли причина сбоя, есть ли в сообщении контекст, не проглатываются ли
ошибки. На собеседовании спрашивают и как правильно объявить исключение, и
какие антипаттерны встречались в реальном коде — пустой `catch`, логирование
без стектрейса, исключения вместо обычного ветвления.

## Ключевые концепции

### Создание

#### Checked или unchecked: от кого наследоваться
Своё исключение наследуют от `Exception`, если это checked, или от
`RuntimeException`, если unchecked. Выбор следует тем же правилам, что и для
стандартных: checked — если вызывающий код может разумно восстановиться и его
нужно заставить об этом подумать. В прикладном коде на Spring чаще выбирают
unchecked: `@Transactional` по умолчанию откатывает транзакцию только на
`RuntimeException` и `Error`, а на checked — фиксирует.

Иерархию строят по смыслу ошибки, а не по месту, где она возникла: базовое
`OrderException` модуля и наследники `OrderNotFoundException`,
`StorageUnavailableException`. Так вызывающий код ловит ровно то, что умеет
обработать. Если подходит стандартное исключение — `IllegalArgumentException`,
`IllegalStateException`, `UnsupportedOperationException`, — новое не заводят
(Effective Java, Item 72).

#### Конструкторы и exception chaining
У `Throwable` четыре основных конструктора: без аргументов, с сообщением, с
причиной и с сообщением и причиной. Своё исключение обычно повторяет хотя бы
два последних варианта, передавая аргументы в `super(message, cause)`. Причина
(cause) — исходное исключение, из-за которого возникло новое.

Цепочка причин (exception chaining) нужна, когда низкоуровневую ошибку
переводят в термины своего слоя: `IOException` хранилища становится
`StorageUnavailableException` сервиса заказов. Вызывающий код работает с
понятной ему абстракцией, а исходная ошибка не теряется и печатается в
стектрейсе блоком `Caused by:`.

```java
static class OrderException extends RuntimeException {
    OrderException(String message) { super(message); }
    OrderException(String message, Throwable cause) { super(message, cause); }
}

static class StorageUnavailableException extends OrderException {
    StorageUnavailableException(String message, Throwable cause) { super(message, cause); }
}

static String loadOrder(long id) {
    try {
        return readFromDisk(id);   // бросает IOException("диск /data недоступен")
    } catch (IOException e) {
        throw new StorageUnavailableException("Не удалось загрузить заказ " + id, e);
    }
}
// main: loadOrder(42) в try, в catch — e.printStackTrace(System.out)
```
```
Custom$StorageUnavailableException: Не удалось загрузить заказ 42
	at Custom.loadOrder(Custom.java:33)
	at Custom.main(Custom.java:48)
Caused by: java.io.IOException: диск /data недоступен
	at Custom.readFromDisk(Custom.java:26)
	at Custom.loadOrder(Custom.java:31)
	... 1 more
```
В одном стектрейсе видно и что не получилось на уровне сервиса, и почему —
на уровне диска. `... 1 more` означает, что последний кадр причины совпадает с
кадром внешнего исключения (`main`), и JVM не печатает его повторно.

Если при оборачивании не передать `e`, вторая половина картины пропадает:
```java
} catch (IOException e) {
    throw new StorageUnavailableException("Не удалось загрузить заказ " + id, null);
}
```
```
Custom$StorageUnavailableException: Не удалось загрузить заказ 42
	at Custom.loadOrderLosingCause(Custom.java:41)
	at Custom.main(Custom.java:55)
```
По такому логу невозможно понять, что сломался диск: исходная `IOException`
уничтожена в `catch`.

#### Контекст в исключении
Хорошее исключение отвечает на вопрос «что именно сломалось» без отладчика.
Значения, по которым видно проблему, — идентификатор заказа, путь к файлу,
недопустимое значение аргумента — включают в сообщение. Если вызывающему коду
нужно обработать их программно, их хранят в `final`-полях исключения с геттерами,
а не разбирают строку сообщения.

```java
static class OrderNotFoundException extends OrderException {
    private final long orderId;
    OrderNotFoundException(long orderId) {
        super("Заказ " + orderId + " не найден");
        this.orderId = orderId;
    }
    long orderId() { return orderId; }
}
// ...
try {
    throw new OrderNotFoundException(7);
} catch (OrderNotFoundException e) {
    System.out.println(e.getMessage() + ", orderId=" + e.orderId());
}
```
```
Заказ 7 не найден, orderId=7
```
Обработчик HTTP-запросов может по типу выбрать ответ 404, а по `orderId()`
построить тело ответа — без парсинга текста сообщения.

### Best practices

#### Пустой catch-блок
Пустой `catch` — худший способ обработать ошибку: исключение исчезает, а
программа продолжает работу с неверным состоянием. Через неделю в проде
появляются «странные» данные, и в логах нет ни строчки о причине. Минимум —
залогировать исключение; лучше — обработать или пробросить дальше.

Если игнорирование действительно намеренное, это делают явно: комментарий с
объяснением и имя переменной `ignored`. Особый случай — `InterruptedException`:
его нельзя просто проглотить, нужно восстановить флаг прерывания через
`Thread.currentThread().interrupt()` (подробнее — в теме «Исключения в
многопоточном коде»).

#### Слишком широкий catch (Exception e)
`catch (Exception e)` вокруг большого блока кода перехватывает всё подряд,
включая `NullPointerException` и `IllegalArgumentException` от собственных
багов. Обработчик, рассчитанный на сбой сети, начинает «обрабатывать» ошибки
программирования — например, повторять запрос, который упал из-за `null`.

Широкий перехват уместен на границах приложения: в обработчике HTTP-запроса
(`@ControllerAdvice`), в цикле обработки сообщений, в задаче пула потоков. Там
задача — не потерять ошибку и не уронить весь процесс. Внутри бизнес-логики
ловят конкретные типы, которые умеют обработать.

#### Логирование с сохранением стектрейса
Самая частая ошибка при логировании — писать только `e.getMessage()`. Сообщения
может не быть вовсе, а тип исключения, стектрейс и цепочка причин теряются.
Исключение передают в логгер отдельным аргументом: в SLF4J — последним
параметром, `log.error("Не удалось загрузить заказ {}", id, e)`.

```java
Logger log = Logger.getLogger("orders");   // java.util.logging
try {
    throw new IllegalStateException();
} catch (IllegalStateException e) {
    log.warning("Ошибка: " + e.getMessage());
    log.log(Level.SEVERE, "Ошибка при обработке заказа 42", e);
}
```
```
WARNING: Ошибка: null
SEVERE: Ошибка при обработке заказа 42
java.lang.IllegalStateException
	at Custom.main(Custom.java:71)
```
По первой строке нельзя понять ни что случилось, ни где. Вторая содержит тип
исключения и место, где оно возникло. Формат вывода здесь упрощён через
`java.util.logging.SimpleFormatter.format`, без даты и имени класса.

#### Исключения не для управления потоком
Основная часть стоимости исключения — не сам `throw`, а стектрейс: конструктор
`Throwable` обходит весь стек вызовов и сохраняет его. Чем глубже стек — а в
Spring-приложении он легко достигает сотни кадров, — тем дороже каждое
исключение. Поэтому их не используют для обычного ветвления: проверки «число ли
это», «есть ли элемент», выхода из цикла.

```java
static class WithTrace extends RuntimeException {
    WithTrace() { super("ошибка"); }
}
static class NoTrace extends RuntimeException {
    NoTrace() { super("ошибка", null, false, false); }   // без suppressed и без стектрейса
}

static boolean isNumberViaException(String s) {
    try {
        Integer.parseInt(s);
        return true;
    } catch (NumberFormatException e) {
        return false;
    }
}
static boolean isNumberViaCheck(String s) { /* цикл по символам: только '0'–'9', длина ≤ 9 */ }
// замер: по 200 000 вызовов каждого варианта после прогревочного прохода,
// исключения бросаются с глубины стека 50
```
```
200000 исключений со стектрейсом (глубина 50): 526 ms
200000 исключений без стектрейса:             297 ms
проверка числа через parseInt + catch: 44109 мкс (100000 чисел)
проверка числа без исключений:         656 мкс (100000 чисел)
```
Проверка через исключение оказалась примерно в 70 раз медленнее обычной, хотя
исключение возникало лишь на половине входов. Защищённый конструктор
`Throwable(message, cause, enableSuppression, writableStackTrace)` убирает
стоимость стектрейса, но разворачивание стека всё равно не бесплатно. Цифры
зависят от машины; для честных замеров используют JMH (раздел 33).

## Частые вопросы на собеседовании

**Q: Как правильно объявить своё исключение?**
A: Унаследовать от `RuntimeException` или `Exception` в зависимости от того,
должен ли вызывающий код обязательно его обработать. Дать конструкторы с
сообщением и с сообщением и причиной, передающие их в `super`. Контекст —
идентификаторы и значения — включить в сообщение, а нужное программно хранить в
`final`-полях. Иерархию строить по смыслу ошибок, а стандартные исключения
переиспользовать, когда они подходят.

**Q: Зачем передавать cause при оборачивании исключения?**
A: Чтобы не потерять исходную ошибку. Обёртка переводит её в термины своего
слоя, а причина остаётся в `getCause()` и печатается в стектрейсе как
`Caused by:`. Без неё в логе будет только «не удалось загрузить заказ», но не
будет видно, что сломался диск или упало соединение с базой.

**Q: Почему пустой catch считается антипаттерном?**
A: Он уничтожает информацию об ошибке: программа продолжает работать с
неверным состоянием, а в логах нет следов причины. Минимум — логировать
исключение целиком, лучше — обработать или пробросить. Для `InterruptedException`
дополнительно нужно восстановить флаг прерывания, иначе код выше по стеку не
узнает, что поток просили остановиться.

**Q: Почему исключения не стоит использовать для управления потоком выполнения?**
A: Создание исключения дорого из-за снятия стектрейса, а разворачивание стека
мешает оптимизациям JIT. Кроме того, такой код плохо читается: исключение
обещает «случилось непредвиденное», а на деле это обычная ветка логики. Для
ожидаемых ситуаций используют проверки, `Optional` или возвращаемый результат.

**Q: Свои исключения в Spring-приложении — checked или unchecked?**
A: Обычно unchecked. `@Transactional` по умолчанию откатывает транзакцию только на
`RuntimeException` и `Error`, а checked-исключение приведёт к коммиту, если не
указать `rollbackFor`. Кроме того, unchecked не загромождают сигнатуры и
нормально работают с лямбдами, а перевод в HTTP-ответ делают централизованно в
`@ControllerAdvice`.

## Ловушки и частые ошибки

#### Потерянная причина при оборачивании
`throw new ServiceException("ошибка")` внутри `catch (SQLException e)` без
передачи `e` выбрасывает исходную ошибку. Так же действует
`throw new ServiceException(e.getMessage())`: текст сохранится, а тип,
стектрейс и вложенные причины — нет. Причину всегда передают вторым аргументом
конструктора.

#### Log and rethrow
Код, который в `catch` логирует исключение и тут же пробрасывает его дальше,
приводит к тому, что одна ошибка оказывается в логе трижды-четырежды — на
каждом уровне. Правило: либо обработать (в том числе залогировать) и не
пробрасывать, либо пробросить без логирования. Логирует тот, кто принимает
окончательное решение.

#### NullPointerException без стектрейса в логах
HotSpot оптимизирует часто повторяющиеся неявные исключения — `NullPointerException`,
`ArithmeticException`, `ArrayIndexOutOfBoundsException`, брошенные самой JVM.
После компиляции горячего метода JIT начинает бросать заранее созданный объект
без сообщения и стектрейса. В логах прода это выглядит как
`java.lang.NullPointerException` без единой строки `at`.

```java
static int length(String s) {
    return s.length();   // неявный NPE при s == null
}
// main: 200 000 раз вызываем length(null) в try/catch и печатаем первый и последний NPE
```
```
$ java FastThrow
NPE #1: message=Cannot invoke "String.length()" because "<parameter1>" is null, кадров в стектрейсе=2
NPE #200000: message=null, кадров в стектрейсе=0

$ java -XX:-OmitStackTraceInFastThrow FastThrow
NPE #1: message=Cannot invoke "String.length()" because "<parameter1>" is null, кадров в стектрейсе=2
NPE #200000: message=Cannot invoke "String.length()" because "<parameter1>" is null, кадров в стектрейсе=2
```
Первое исключение полноценное, а к 200 000-му JIT заменил его «быстрым» —
без сообщения и стектрейса. Флаг `-XX:-OmitStackTraceInFastThrow` отключает
оптимизацию. На практике полезно искать в логах первое вхождение той же
ошибки — оно ещё со стектрейсом.

#### Секреты и персональные данные в сообщениях
Сообщения исключений попадают в логи, системы мониторинга и иногда — в ответ
клиенту. Пароль, токен или номер карты в тексте исключения — это утечка. В
сообщение кладут идентификаторы, а не сами чувствительные данные, а наружу
отдают обобщённый ответ без стектрейса.

## Связанные темы
- [Иерархия исключений](01-exception-hierarchy.md) — стандартные исключения и правила checked/unchecked.
- [Механизм try-catch-finally](02-try-catch-finally.md) — подавленные исключения и закрытие ресурсов.
- [Исключения в многопоточном коде](04-exceptions-in-concurrency.md) — `InterruptedException` и потерянные исключения в пулах потоков.
- Логирование: SLF4J, Logback/Log4j2 и MDC (раздел 27) — передача исключения в логгер и структурированные логи.
- Транзакции в Spring: @Transactional изнутри (раздел 18) — правила отката по типу исключения.
- JIT-компиляция и оптимизации (раздел 9) — откуда берутся «быстрые» исключения без стектрейса.

## Источники
- [javadoc java.lang.Throwable](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Throwable.html) — конструкторы, `getCause`, `addSuppressed`, `writableStackTrace`.
- Joshua Bloch, «Effective Java», 3rd ed.: Item 69 «Use exceptions only for exceptional conditions», Item 72 «Favor the use of standard exceptions», Item 73 «Throw exceptions appropriate to the abstraction», Item 75 «Include failure-capture information in detail messages», Item 77 «Don't ignore exceptions».
- [Spring Framework: Rolling back a declarative transaction](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html).
- Aleksey Shipilev, [«The Exceptional Performance of Lil' Exception»](https://shipilev.net/blog/2014/exceptional-performance/) — подробный разбор стоимости исключений.
