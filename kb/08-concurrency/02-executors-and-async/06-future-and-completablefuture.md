---
title: "Future и CompletableFuture"
section: 8
section_title: "Многопоточность и Concurrency"
topic_slug: "08-06-future-and-completablefuture"
roadmap_ref: "Раздел 8 → Future и CompletableFuture"
status: not-started
tags: [future, completablefuture, async, thencompose, timeout, cancellation]
related:
  - "08-05-thread-pools"
  - "08-09-threadlocal-and-forkjoin"
  - "08-11-structured-concurrency-and-scoped-values"
  - "04-04-exceptions-in-concurrency"
  - "07-05-parallel-streams"
  - "18-09-webflux"
last_reviewed: null
---

`Future` — результат задачи, который появится позже, а `CompletableFuture` —
его развитие: цепочки асинхронных шагов без блокировки потоков. Это основной
инструмент для параллельных вызовов внешних сервисов в Java до виртуальных
потоков и до сих пор — для асинхронных API. На собеседовании проверяют разницу
`thenApply`/`thenCompose`/`thenApplyAsync`, понимание того, в каком потоке
выполняется каждая стадия, распространение исключений и семантику отмены.

## Ключевые концепции

### Future

#### get() и таймаут
`Future<V>` возвращается из `ExecutorService.submit()` и представляет
результат задачи, которая выполняется в другом потоке. Главный метод — `get()`:
он блокирует вызывающий поток до завершения задачи. Вариант `get(timeout,
unit)` ждёт не дольше заданного времени и бросает `TimeoutException`, но сама
задача при этом продолжает выполняться.

```java
Future<String> slow = ex.submit(() -> {
    Thread.sleep(5_000);
    return "готово";
});
slow.get(200, TimeUnit.MILLISECONDS);   // перехвачено
```
```
get(200 мс): TimeoutException, задача продолжает работать: true
```
Таймаут ограничивает только ожидание вызывающего потока. Если результат больше
не нужен, задачу надо отменить явно, иначе она будет занимать поток пула.

#### cancel() и состояние
`cancel(mayInterruptIfRunning)` отменяет задачу. Если она ещё в очереди, то
просто не начнётся. Если уже выполняется, то с `true` её поток получит
`interrupt()`, а с `false` задача доработает, но результат будет отброшен.
После отмены `isCancelled()` и `isDone()` возвращают `true`, а `get()` бросает
`CancellationException`.

```java
System.out.println("cancel(true): " + slow.cancel(true));
System.out.println("isCancelled=" + slow.isCancelled() + ", isDone=" + slow.isDone() + ", state=" + slow.state());
slow.get();   // перехвачено
```
```
задача получила interrupt от cancel(true)
cancel(true): true
isCancelled=true, isDone=true, state=CANCELLED
get() после отмены: CancellationException
```
Задача из пула получила прерывание и завершилась. `isDone()` возвращает
`true` при любом завершении — успешном, с ошибкой или отменой.

#### ExecutionException
Исключение, брошенное задачей, `get()` заворачивает в проверяемое
`ExecutionException`, а оригинал лежит в `getCause()`. Отдельно `get()`
бросает `InterruptedException` — это прерывание не задачи, а потока, который
ждёт результат. Обработка поэтому различает три случая: ошибка задачи,
прерывание ожидающего потока и таймаут. Подробно с примерами — в теме об
исключениях в многопоточном коде.

#### FutureTask и новые методы
`submit()` оборачивает задачу в `FutureTask` — класс, который реализует
одновременно `Runnable` (его выполняет поток пула) и `Future` (его получает
вызывающий код). `FutureTask` можно создать и запустить вручную, например в
обычном `Thread`.

В Java 19 у `Future` появились неблокирующие методы для уже завершённых задач:
`state()` возвращает `RUNNING`, `SUCCESS`, `FAILED` или `CANCELLED`, а
`resultNow()` и `exceptionNow()` отдают результат или исключение без
проверяемых исключений — и бросают `IllegalStateException`, если задача ещё не
завершена так, как ожидается.
```java
Future<Integer> ok = ex.submit(() -> 42);
ok.get();
System.out.println("state=" + ok.state() + ", resultNow()=" + ok.resultNow());
```
```
state=SUCCESS, resultNow()=42
```
Удобно в потоках обработки, где задачи уже гарантированно завершены, —
например после `invokeAll`.

#### Ограничения Future
`Future` умеет только ждать. Нельзя сказать «когда результат будет готов,
сделай с ним вот это» — продолжение требует блокирующего `get()` в каком-то
потоке. Нельзя завершить `Future` вручную, если результат пришёл из
callback-API. Нельзя скомбинировать несколько `Future` — дождаться первого или
всех — без ручного кода. Эти ограничения и закрывает `CompletableFuture`
(Java 8).

### CompletableFuture: создание и потоки выполнения

#### supplyAsync и пул по умолчанию
`CompletableFuture.supplyAsync(supplier)` запускает задачу с результатом,
`runAsync(runnable)` — без. Без явного executor задача выполняется в
`ForkJoinPool.commonPool()` — общем пуле с числом потоков на единицу меньше
числа ядер, который делят с ним parallel streams и все остальные
`CompletableFuture` приложения.

Для коротких вычислений это нормально, но блокирующий ввод-вывод в общем
пуле быстро занимает его потоки и тормозит всё приложение. Поэтому задачи с
вызовами HTTP, базы и файлов запускают со своим пулом вторым аргументом:
```java
ExecutorService io = Executors.newFixedThreadPool(2, Thread.ofPlatform().name("io-", 1).factory());
CompletableFuture.supplyAsync(() -> thread(), io)
        .thenAccept(t -> System.out.println("supplyAsync с executor: " + t)).join();
```
```
supplyAsync с executor: io-1
```
Каждый асинхронный метод (`*Async`) имеет перегрузку с `Executor`, и в
серверном коде её используют почти всегда.

#### Ручное завершение
`CompletableFuture` можно создать пустым и завершить вручную: `complete(value)`
— успехом, `completeExceptionally(ex)` — ошибкой. Это мост между старыми
callback-API и цепочками: колбэк завершает future, а остальной код работает с
ним как с обычной асинхронной стадией. Для готовых значений есть фабрики
`completedFuture(value)` и `failedFuture(ex)` (Java 9).

```java
CompletableFuture<String> bridge = new CompletableFuture<>();
legacyFetch("user-7", bridge::complete, bridge::completeExceptionally);
System.out.println("результат колбэка: " + bridge.join());
```
```
результат колбэка: профиль user-7
```
`legacyFetch` ничего не знает о `CompletableFuture` и принимает два колбэка.
Ссылки на методы `complete` и `completeExceptionally` превратили его в
асинхронную стадию.

#### Синхронные и асинхронные стадии
Методы без `Async` — `thenApply`, `thenAccept`, `thenCompose` — не создают
задачу в пуле. Если стадия уже завершена к моменту вызова, функция
выполняется сразу в вызывающем потоке. Если нет — её выполнит поток, который
завершит предыдущую стадию. Методы с `Async` всегда отправляют функцию в
executor, по умолчанию в `commonPool`.

```java
CompletableFuture<String> done = CompletableFuture.completedFuture("x");
done.thenApply(s -> { System.out.println("thenApply у завершённой стадии: " + thread()); return s; });
CompletableFuture<String> pending = CompletableFuture.supplyAsync(() -> {
    System.out.println("supplyAsync без executor: " + thread());
    sleep(100);
    return "y";
});
pending.thenApply(s -> { System.out.println("thenApply у незавершённой стадии: " + thread()); return s; })
       .thenApplyAsync(s -> { System.out.println("thenApplyAsync: " + thread()); return s; })
       .join();
```
```
thenApply у завершённой стадии: main
supplyAsync без executor: ForkJoinPool.commonPool-worker-1
thenApply у незавершённой стадии: ForkJoinPool.commonPool-worker-1
thenApplyAsync: ForkJoinPool.commonPool-worker-1
```
Одна и та же `thenApply` выполнилась в `main` и в потоке пула — в зависимости
от того, успела ли завершиться предыдущая стадия. Поэтому тяжёлую работу в
синхронных стадиях не делают: она может оказаться в потоке, который не
ожидает такой нагрузки, например в потоке обработки сетевых событий.

### Композиция

#### thenCompose
`thenApply` применяет обычную функцию к результату, а `thenCompose` — функцию,
которая сама возвращает `CompletableFuture`. Это аналог `flatMap` из Stream API
и `Optional`: вложенная асинхронность «сплющивается». Нужен он, когда
следующий шаг зависит от результата предыдущего и тоже асинхронный: найти
пользователя, затем загрузить его заказы.

```java
CompletableFuture<CompletableFuture<Integer>> nested = findUserId("anna").thenApply(Futures::loadOrderCount);
CompletableFuture<Integer> flat = findUserId("anna").thenCompose(Futures::loadOrderCount);
System.out.println("thenApply: " + nested.join().join() + " (CompletableFuture внутри CompletableFuture)");
System.out.println("thenCompose: " + flat.join());
```
```
thenApply: 3 (CompletableFuture внутри CompletableFuture)
thenCompose: 3
```
С `thenApply` получился неудобный тип с двойной обёрткой и двойным `join()`.
`thenCompose` даёт плоский `CompletableFuture<Integer>`, с которым цепочка
продолжается естественно.

#### thenCombine
`thenCombine` объединяет результаты двух независимых стадий, которые
выполняются параллельно: функция вызывается, когда готовы обе. Типичный пример
— курс валюты и сумма из разных сервисов. Время цепочки определяется самой
медленной из двух стадий, а не их суммой.

```java
CompletableFuture<Double> rate = CompletableFuture.supplyAsync(() -> { sleep(100); return 90.5; });
CompletableFuture<Integer> amount = CompletableFuture.supplyAsync(() -> { sleep(150); return 10; });
System.out.println("thenCombine: " + rate.thenCombine(amount, (r, a) -> r * a).join());
```
```
thenCombine: 905.0
```
Обе стадии стартовали сразу, и результат готов примерно через 150 мс. Важно
создать обе стадии до комбинирования: если вторая создаётся внутри первой,
параллелизма не будет.

#### allOf и anyOf
`allOf(cfs...)` завершается, когда завершены все переданные стадии, но
возвращает `CompletableFuture<Void>` — результаты забирают из исходных стадий
через `join()`, который после `allOf` уже не блокирует. `anyOf(cfs...)`
завершается с результатом первой готовой стадии и возвращает
`CompletableFuture<Object>`, так что результат приходится приводить к типу.

```java
List<CompletableFuture<Integer>> prices = IntStream.of(300, 100, 200)
        .mapToObj(ms -> CompletableFuture.supplyAsync(() -> { sleep(ms); return ms; }))
        .toList();
CompletableFuture<Void> all = CompletableFuture.allOf(prices.toArray(CompletableFuture[]::new));
List<Integer> results = all.thenApply(v -> prices.stream().map(CompletableFuture::join).toList()).join();
System.out.println("allOf: " + results);
// новые три задачи с теми же задержками
Object first = CompletableFuture.anyOf(race).join();
System.out.println("anyOf: " + first);
```
```
allOf: [300, 100, 200]
anyOf: 100
```
`allOf` сохранил порядок исходного списка, `anyOf` вернул самую быструю.
Ни `allOf`, ни `anyOf` не отменяют остальные стадии: если одна упала,
остальные продолжают работать, — эту проблему решает structured concurrency.

#### Завершающие действия и «одна из двух»
`thenAccept` потребляет результат без возвращаемого значения, `thenRun`
выполняет действие, не глядя на результат. Для двух стадий есть
«первая из двух»: `applyToEither` применяет функцию к результату той, что
завершилась раньше, `acceptEither` и `runAfterEither` — аналоги без
результата. Это способ отправить запрос двум репликам и взять самый быстрый
ответ.

```java
CompletableFuture<String> a1 = CompletableFuture.supplyAsync(() -> { sleep(300); return "реплика A"; });
CompletableFuture<String> b1 = CompletableFuture.supplyAsync(() -> { sleep(100); return "реплика B"; });
System.out.println("applyToEither: " + a1.applyToEither(b1, s -> "ответила " + s).join());
```
```
applyToEither: ответила реплика B
```
Функция получила ответ быстрой реплики. Медленная при этом продолжает
работать: её стоит отменить, если результат больше не нужен.

### Обработка ошибок

#### exceptionally, handle и whenComplete
Исключение в стадии завершает её с ошибкой, и все зависимые `thenApply`,
`thenAccept`, `thenCompose` пропускаются до первого обработчика.
`exceptionally(fn)` вызывается только при ошибке и подставляет запасное
значение. `handle((res, ex) -> …)` вызывается всегда и возвращает новое
значение. `whenComplete((res, ex) -> …)` тоже вызывается всегда, но результат
не меняет — подходит для логирования и метрик.

Пошаговый разбор распространения ошибки по цепочке со схемой и примерами
каждого обработчика — в теме об исключениях в многопоточном коде. Здесь
важнее два нюанса, на которых чаще всего ошибаются.

#### CompletionException
Исключение, брошенное внутри `supplyAsync` или функции стадии, обработчики
получают завёрнутым в `CompletionException`. Но если future завершили вручную
через `completeExceptionally`, обработчик увидит исходное исключение без
обёртки. Поэтому надёжный обработчик разворачивает `CompletionException`
перед проверкой типа.

```java
CompletableFuture<String> failedAsync = CompletableFuture.supplyAsync(() -> { throw new IllegalStateException("сбой"); });
failedAsync.exceptionally(e -> { System.out.println("после supplyAsync: " + e.getClass().getSimpleName()); return null; }).join();
CompletableFuture<String> failedManual = new CompletableFuture<>();
failedManual.completeExceptionally(new IllegalStateException("сбой"));
failedManual.exceptionally(e -> { System.out.println("после completeExceptionally: " + e.getClass().getSimpleName()); return null; }).join();
```
```
после supplyAsync: CompletionException
после completeExceptionally: IllegalStateException
```
Одно и то же исключение пришло в обработчик в двух разных видах. Проверка
`e instanceof IllegalStateException` сработала бы только во втором случае.

#### join() против get()
`get()` бросает проверяемые `ExecutionException` и `InterruptedException`, как
у обычного `Future`. `join()` бросает непроверяемое `CompletionException` и
поэтому удобен в лямбдах и стримах. Ещё одно отличие — `join()` не реагирует
на прерывание ожидающего потока: он будет ждать до завершения стадии. В обоих
случаях исходное исключение достают через `getCause()`.

#### exceptionallyCompose
`exceptionally` подставляет запасное значение синхронно. Если восстановление
само асинхронное — например, запрос к резервному сервису, — нужен
`exceptionallyCompose` (Java 12): функция получает исключение и возвращает
новую стадию. Есть и `exceptionallyAsync`, выполняющий обработчик в executor.

```java
String fallback = CompletableFuture.<String>failedFuture(new RuntimeException("основной сервис недоступен"))
        .exceptionallyCompose(e -> CompletableFuture.supplyAsync(() -> "ответ резервного сервиса"))
        .join();
System.out.println("exceptionallyCompose: " + fallback);
```
```
exceptionallyCompose: ответ резервного сервиса
```
Ошибка основного вызова превратилась в асинхронный запрос к резерву без
блокировок и вложенных `join()`.

### Таймауты и отмена

#### orTimeout и completeOnTimeout
В Java 9 появились таймауты на уровне стадии. `orTimeout(time, unit)`
завершает future с `TimeoutException`, если результата нет вовремя.
`completeOnTimeout(value, time, unit)` вместо ошибки подставляет значение по
умолчанию. Срабатывание обслуживает отдельный служебный поток-планировщик, а не
поток задачи.

```java
CompletableFuture.supplyAsync(() -> { sleep(1000); return "поздно"; })
        .orTimeout(200, TimeUnit.MILLISECONDS).join();   // перехвачено
String dflt = CompletableFuture.supplyAsync(() -> { sleep(1000); return "поздно"; })
        .completeOnTimeout("значение по умолчанию", 200, TimeUnit.MILLISECONDS).join();
System.out.println("completeOnTimeout: " + dflt);
```
```
orTimeout: java.util.concurrent.TimeoutException
completeOnTimeout: значение по умолчанию
```
Обе цепочки вернули управление через 200 мс. Но, как и у `cancel`, задача,
которая спит секунду, продолжает работать: таймаут завершает future, а не
останавливает вычисление.

#### cancel(true) не прерывает задачу
У `CompletableFuture` нет связи с потоком, который его вычисляет, — это просто
контейнер для результата. Поэтому `cancel(true)` лишь завершает future с
`CancellationException`, а параметр `mayInterruptIfRunning` игнорируется:
задача в пуле не получает прерывания и работает до конца.

```java
CompletableFuture<String> work = CompletableFuture.supplyAsync(() -> {
    for (int i = 1; i <= 3; i++) {
        sleep(100);
        System.out.println("задача работает, шаг " + i + ", interrupted=" + Thread.currentThread().isInterrupted());
    }
    return "результат никому не нужен";
});
System.out.println("cancel(true): " + work.cancel(true) + ", isCancelled=" + work.isCancelled());
work.join();   // перехвачено
```
```
cancel(true): true, isCancelled=true
join(): CancellationException
задача работает, шаг 1, interrupted=false
задача работает, шаг 2, interrupted=false
задача работает, шаг 3, interrupted=false
```
Future отменён, а задача честно выполнила все три шага без флага прерывания.
Для настоящей отмены задача должна сама проверять общий флаг, или её
запускают через `ExecutorService.submit`, где `cancel(true)` прерывает поток.

#### Вложенный join() в ограниченном пуле
Блокирующий `join()` внутри стадии занимает поток пула на всё время ожидания.
Если вложенная стадия выполняется в том же ограниченном пуле, а все его потоки
уже ждут, она никогда не начнётся — классический thread starvation deadlock.

```java
ExecutorService two = Executors.newFixedThreadPool(2, Thread.ofPlatform().daemon(true).factory());
List<CompletableFuture<String>> outers2 = IntStream.range(0, 2)
        .mapToObj(i -> CompletableFuture.supplyAsync(() ->
                CompletableFuture.supplyAsync(() -> "inner", two).join(), two))
        .toList();
CompletableFuture.allOf(outers2.toArray(CompletableFuture[]::new)).get(1, TimeUnit.SECONDS);   // перехвачено
```
```
не завершились за 1 с: оба потока пула ждут подзадачи, которым нет потока
```
Оба потока пула заняты внешними задачами, которые ждут внутренние. Потоки
пришлось сделать daemon: `join()` не реагирует на `shutdownNow()`, и
зависшие потоки не дали бы JVM завершиться.

У `ForkJoinPool.commonPool()` есть защита: `join()` в его рабочем потоке
сообщает пулу о блокировке, и пул временно добавляет компенсирующий поток.
Поэтому распространённое утверждение «вложенный `join()` в common pool
гарантированно даёт deadlock» неверно:
```java
// parallelism × 3 внешних задач, каждая ждёт свою вложенную через join()
List<CompletableFuture<String>> outers = IntStream.range(0, parallelism * 3)
        .mapToObj(i -> CompletableFuture.supplyAsync(() ->
                CompletableFuture.supplyAsync(() -> { sleep(50); return "inner"; }).join()))
        .toList();
```
```
parallelism=19, 57 внешних задач с вложенным join() завершились
```
Но компенсация ограничена и дорога, а в собственных пулах её нет. Правильное
решение в обоих случаях — `thenCompose` вместо вложенного `join()`.

## Частые вопросы на собеседовании

**Q: Чем thenApply отличается от thenCompose и от thenApplyAsync?**
A: `thenApply` применяет обычную функцию к результату, `thenCompose` — функцию,
которая возвращает `CompletableFuture`, и «сплющивает» вложенность, как
`flatMap`; он нужен для зависимых асинхронных вызовов. `thenApplyAsync` делает
то же, что `thenApply`, но всегда отправляет функцию в executor, по умолчанию в
`ForkJoinPool.commonPool()`, тогда как синхронный вариант выполняется в потоке,
завершившем предыдущую стадию, или в вызывающем.

**Q: В каком потоке выполнится каждая стадия?**
A: `supplyAsync`/`runAsync` и методы `*Async` — в переданном executor или в
`commonPool`. Синхронные методы — в потоке, который завершил предыдущую стадию,
а если она уже завершена к моменту вызова — сразу в вызывающем потоке. Из-за
этой недетерминированности в синхронных стадиях не делают тяжёлой или
блокирующей работы.

**Q: Что произойдёт с цепочкой, если одна из стадий бросит исключение?**
A: Стадия завершится с ошибкой, обёрнутой в `CompletionException`, и все
зависимые `thenApply`, `thenAccept`, `thenCompose` пропустятся до первого
обработчика — `exceptionally`, `handle` или `whenComplete`. `exceptionally` и
`handle` могут превратить ошибку в значение, `whenComplete` только наблюдает.
Если обработчика нет, ошибку получит тот, кто вызовет `join()` или `get()`.

**Q: Прервёт ли cancel(true) задачу CompletableFuture?**
A: Нет. `CompletableFuture` не знает, какой поток его вычисляет, поэтому
`cancel(true)` только завершает future с `CancellationException`, а задача
продолжает работу. Зависимые стадии при этом тоже завершатся с ошибкой. Для
прерываемой отмены задачу запускают через `ExecutorService.submit` или
проверяют флаг отмены внутри задачи.

**Q: Чем allOf отличается от anyOf?**
A: `allOf` ждёт завершения всех стадий и возвращает `CompletableFuture<Void>`:
результаты забирают из исходных стадий. `anyOf` завершается с результатом или
ошибкой первой готовой стадии и возвращает `CompletableFuture<Object>`.
Ни один из них не отменяет оставшиеся стадии — это нужно делать вручную.

## Ловушки и частые ошибки

#### Блокирующий ввод-вывод в commonPool
`supplyAsync` без executor для HTTP-вызова или запроса к базе занимает поток
общего пула на всё время ожидания. Пул маленький, его делят parallel streams и
все `CompletableFuture` приложения, и несколько медленных вызовов тормозят
несвязанные части системы. Для ввода-вывода всегда передают свой пул или, на
Java 21, исполнитель виртуальных потоков.

#### Потерянная ошибка в цепочке без обработчика
Цепочка `supplyAsync(...).thenAccept(...)`, которую никто не ждёт через
`join()` и у которой нет `exceptionally`, проглатывает исключения бесследно.
Каждая «запущенная и забытая» цепочка должна заканчиваться обработчиком,
который хотя бы логирует ошибку.

#### Проверка типа исключения без развёртки
`exceptionally(e -> e instanceof TimeoutException ? ... : ...)` часто не
срабатывает, потому что `e` — это `CompletionException`, а нужное исключение
лежит в `getCause()`. А при ручном `completeExceptionally` обёртки нет. Надёжный
обработчик разворачивает `CompletionException` перед проверкой.

#### Создание стадий внутри цепочки
`supplyAsync(a).thenCompose(x -> supplyAsync(b))` выполняет `b` только после
`a`, даже если `b` от `a` не зависит. Независимые запросы создают заранее и
объединяют через `thenCombine` или `allOf` — тогда они идут параллельно.

## Связанные темы
- [Пулы потоков](05-thread-pools.md) — executor для асинхронных стадий и `Future` из `submit()`.
- [ThreadLocal и Fork/Join](../03-concurrency-utilities/09-threadlocal-and-forkjoin.md) — устройство `ForkJoinPool.commonPool()`.
- [Structured Concurrency и Scoped Values](../04-project-loom/11-structured-concurrency-and-scoped-values.md) — автоматическая отмена подзадач.
- [Исключения в многопоточном коде](../../04-exceptions/04-exceptions-in-concurrency.md) — распространение ошибок по цепочке, `exceptionally`, `handle`, `whenComplete`.
- [Параллельные стримы](../../07-streams-functional/05-parallel-streams.md) — общий `commonPool` с `CompletableFuture`.
- Реактивный стек: Spring WebFlux (раздел 18) — асинхронность на основе реактивных потоков.

## Источники
- [javadoc CompletableFuture](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/CompletableFuture.html) — потоки выполнения стадий, отмена, таймауты.
- [javadoc Future](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/Future.html) — `state()`, `resultNow()`, `exceptionNow()`.
- [JEP 266: More Concurrency Updates](https://openjdk.org/jeps/266) — `orTimeout`, `completeOnTimeout`, `failedFuture` и другие дополнения Java 9.
