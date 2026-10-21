---
title: "Параллельные стримы"
section: 7
section_title: "Функциональный стиль и Stream API (Java 8+)"
topic_slug: "07-05-parallel-streams"
roadmap_ref: "Раздел 7 → Параллельные стримы"
status: not-started
tags: [parallel-streams, forkjoinpool, spliterator, thread-safety, performance]
related:
  - "07-03-stream-api"
  - "07-04-collectors"
  - "08-09-threadlocal-and-forkjoin"
  - "08-06-future-and-completablefuture"
  - "33-01-profiling"
last_reviewed: null
---

`parallelStream()` выглядит как бесплатное ускорение: одно слово — и работа
разошлась по всем ядрам. На практике параллельный стрим часто медленнее
последовательного, может дать неверный результат и способен застопорить
асинхронные задачи всего приложения. На собеседовании проверяют, понимает ли
кандидат механизм и знает ли, когда параллелизм оправдан.

## Ключевые концепции

### Механизм

#### Разбиение через Spliterator и ForkJoinPool.commonPool
Параллельный стрим использует тот же конвейер, что и последовательный, но
источник делится на части через `Spliterator.trySplit`. Части обрабатываются как
задачи fork/join, а результаты объединяются: у `reduce` — через функцию
объединения, у `collect` — через `combiner` коллектора. Задачи выполняются в
общем пуле `ForkJoinPool.commonPool()`, а поток, запустивший стрим, тоже
участвует в работе.

Качество разбиения определяет выигрыш. `ArrayList`, массивы и `IntStream.range`
делятся точно пополам за O(1). `LinkedList` и `Stream.iterate` приходится обходить
последовательно, чтобы отделить часть, и параллелизм почти ничего не даёт.

```java
Set<String> threads = ConcurrentHashMap.newKeySet();
IntStream.range(0, 10_000).parallel().forEach(i -> threads.add(Thread.currentThread().getName().replaceAll("\\d+$", "N")));
System.out.println("потоки, выполнявшие parallel(): " + new TreeSet<>(threads));
```
```
потоки, выполнявшие parallel(): [ForkJoinPool.commonPool-worker-N, main]
```
Работу выполнили потоки общего пула и сам `main`, вызвавший терминальную
операцию.

#### Число потоков по умолчанию
Параллелизм общего пула по умолчанию — число доступных процессоров минус один:
ещё один поток — тот, что запустил стрим. Значение задаётся системным свойством
`-Djava.util.concurrent.ForkJoinPool.common.parallelism=N` при старте JVM. В
контейнере JVM учитывает лимиты CPU, поэтому на поде с двумя ядрами пул будет
крошечным.

```java
System.out.println("ядер: " + Runtime.getRuntime().availableProcessors()
        + ", ForkJoinPool.commonPool parallelism: " + ForkJoinPool.commonPool().getParallelism());
```
```
ядер: 20, ForkJoinPool.commonPool parallelism: 19
```
Один пул на всё приложение — и именно это становится источником проблем ниже.

### Риски

#### Накладные расходы на маленьких данных
Параллельный стрим платит за разбиение источника, создание задач, передачу их
потокам и объединение результатов. На маленьких коллекциях или дешёвых
операциях эти расходы больше полезной работы. Даже на больших данных выигрыш
ограничен, если задача упирается в память, а не в вычисления: ядра ждут данные
из RAM.

Ориентир из практики — модель NQ: параллелизм окупается, когда произведение
числа элементов N на стоимость обработки одного элемента Q велико (порядка
10 000 «простых операций» и больше), источник хорошо делится, а операции не
содержат блокировок.
Решение принимают по замеру, а не по интуиции.

```java
// третий проход после прогрева
// map(x -> x * x).sum() и mapToLong(x -> x * x % 7).sum() на разных источниках
```
```
1 000 элементов:      последовательно 50 мкс, parallel 246 мкс
50 млн элементов:     последовательно 44 ms, parallel 21 ms
1 млн, parallel:      LinkedList 12 ms, ArrayList 1 ms
(суммы совпадают: true)
```
На тысяче элементов параллельная версия впятеро медленнее. На 50 миллионах она
быстрее лишь вдвое при двадцати ядрах — операция дешёвая, и всё упирается в
память. `LinkedList` делится плохо и проигрывает `ArrayList` в 12 раз.

#### Побочные эффекты и общее изменяемое состояние
Лямбды параллельного стрима выполняются одновременно в разных потоках. Запись в
общий `ArrayList`, `HashMap` или счётчик без синхронизации — гонка данных:
элементы теряются, размер портится, а то и вылетает
`ArrayIndexOutOfBoundsException` при одновременном расширении массива.

Правильный путь — не изменять внешнее состояние, а собирать результат через
`collect`, `reduce` или `toList()`: каждая часть копит свой контейнер, а
объединение происходит в одном потоке. Кроме того, `forEach` в параллельном
стриме не сохраняет порядок; если он нужен, используют `forEachOrdered`, ценой
части параллелизма.

```java
for (int attempt = 1; attempt <= 3; attempt++) {
    List<Integer> unsafe = new ArrayList<>();
    IntStream.range(0, 100_000).parallel().forEach(unsafe::add);   // гонка; исключение перехвачено
    System.out.println("попытка " + attempt + ": size=" + unsafe.size() + " (ожидалось 100000)");
}
List<Integer> safe = IntStream.range(0, 100_000).parallel().boxed().collect(Collectors.toList());
System.out.println("через collect: size=" + safe.size());
```
```
попытка 1: ArrayIndexOutOfBoundsException
попытка 2: size=9311 (ожидалось 100000)
попытка 3: ArrayIndexOutOfBoundsException
через collect: size=100000
```
Два запуска упали, а третий молча потерял больше 90% элементов. Через `collect`
результат верный при любом числе потоков.

Порядок:
```java
IntStream.rangeClosed(1, 8).parallel().forEach(i -> { synchronized (a) { a.append(i); } });
IntStream.rangeClosed(1, 8).parallel().forEachOrdered(b::append);
System.out.println("forEach: " + a + ", forEachOrdered: " + b + ", toList: " + IntStream.rangeClosed(1, 8).parallel().boxed().toList());
```
```
forEach: 63542718, forEachOrdered: 12345678, toList: [1, 2, 3, 4, 5, 6, 7, 8]
```
`forEach` выдал элементы в порядке готовности потоков, а `forEachOrdered` и
`toList()` сохранили порядок источника.

#### Блокирующие операции истощают общий пул
Все параллельные стримы приложения, а также `CompletableFuture.supplyAsync` без
явного executor работают в одном `commonPool`. Если лямбда параллельного стрима
блокируется — ходит по HTTP, в базу, ждёт `sleep`, — потоки пула заняты
ожиданием. Остальные задачи приложения, которым нужен тот же пул, стоят в
очереди.

Для блокирующей работы параллельные стримы не используют: берут отдельный
`ExecutorService` нужного размера или виртуальные потоки (Java 21). Известный
приём — запустить параллельный стрим внутри своего `ForkJoinPool` через
`pool.submit(...)`, — работает, но опирается на деталь реализации.

```java
int p = ForkJoinPool.commonPool().getParallelism();
CompletableFuture<Void> blocker = CompletableFuture.runAsync(() ->
        IntStream.range(0, p * 2).parallel().forEach(i -> sleep(1000)));   // «ходим в сеть» внутри parallel
Thread.sleep(100);
long t = System.nanoTime();
CompletableFuture.supplyAsync(() -> "лёгкая задача").get();               // тоже commonPool
System.out.println("лёгкая задача в commonPool ждала " + ms(t) + " ms");

ForkJoinPool own = new ForkJoinPool(4);
own.submit(() -> IntStream.range(0, 1000).parallel().forEach(i -> /* собираем имена потоков */ {})).get();
```
```
лёгкая задача в commonPool ждала 900 ms
parallel() внутри своего ForkJoinPool: [ForkJoinPool-1-worker-N]
```
Задача, которой нужны микросекунды, ждала почти секунду: все потоки общего пула
спали внутри чужого стрима. Внутри своего `ForkJoinPool` стрим использовал его
потоки и не тронул общий пул.

## Частые вопросы на собеседовании

**Q: Как работает parallelStream?**
A: Источник делится через `Spliterator.trySplit` на части, которые
обрабатываются как fork/join-задачи в `ForkJoinPool.commonPool()`; поток,
запустивший стрим, тоже участвует. Результаты частей объединяются через
`combiner` коллектора или функцию `reduce`. Конвейер операций тот же, что и у
последовательного стрима.

**Q: Сколько потоков использует параллельный стрим?**
A: Общий пул имеет параллелизм «число процессоров минус один», плюс вызывающий
поток. Значение меняют системным свойством
`java.util.concurrent.ForkJoinPool.common.parallelism`. Пул один на всё
приложение и общий с `CompletableFuture` без явного executor.

**Q: Когда параллельный стрим медленнее последовательного?**
A: На маленьких данных и дешёвых операциях, где накладные расходы на разбиение и
объединение больше выигрыша; на плохо делящихся источниках вроде `LinkedList` и
`Stream.iterate`; при задачах, упирающихся в память; при stateful-операциях и
`forEachOrdered`. Решение о параллелизме принимают по замеру.

**Q: Почему нельзя делать блокирующие вызовы в parallelStream?**
A: Потоки `commonPool` будут ждать ввода-вывода вместо вычислений, а этот пул
общий для всех параллельных стримов и асинхронных задач приложения. Одна такая
операция замедляет всё остальное. Для блокирующей работы используют отдельный
executor или виртуальные потоки.

**Q: Как безопасно собрать результат параллельного стрима?**
A: Через `collect`, `reduce` или `toList()`, а не через запись в общую коллекцию
из `forEach`. Коллекторы дают каждой части свой контейнер и сливают их в одном
потоке. Функции `reduce` должны быть ассоциативными, а identity — действительно
нейтральным элементом.

## Ловушки и частые ошибки

#### parallel() «на всякий случай»
Добавление `.parallel()` без замера чаще замедляет код, чем ускоряет, и делает его
поведение зависимым от загрузки общего пула. В веб-сервисе, где запросы и так
обрабатываются параллельно, параллельный стрим в каждом запросе конкурирует с
остальными за те же ядра.

#### Неассоциативный reduce
`reduce` в параллельном режиме объединяет частичные результаты в произвольной
группировке. Неассоциативная операция, например вычитание, или неверный
identity (`reduce(10, Integer::sum)` прибавит 10 к каждой части) дают разный
результат в зависимости от разбиения. В последовательном режиме ошибка не видна.

#### Порядок и findAny
В параллельном стриме `findAny` возвращает любой подходящий элемент, а не первый,
и `forEach` не соблюдает порядок. Код, который случайно полагался на порядок,
начинает вести себя иначе после добавления `parallel()`. `unordered()` наоборот
может ускорить параллельный стрим, если порядок действительно не важен.

## Связанные темы
- [Stream API](03-stream-api.md) — `Spliterator`, конвейер и stateful-операции.
- [Collectors](04-collectors.md) — `combiner` и объединение частичных результатов.
- ThreadLocal и Fork/Join (раздел 8) — устройство `ForkJoinPool` и work stealing.
- Future и CompletableFuture (раздел 8) — общий пул у асинхронных задач.
- Профилирование приложения (раздел 33) — как измерять, а не угадывать.

## Источники
- [javadoc пакета java.util.stream](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/stream/package-summary.html) — раздел «Parallelism».
- [javadoc java.util.concurrent.ForkJoinPool](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ForkJoinPool.html) — свойства общего пула.
- Doug Lea, [«When to use parallel streams»](https://gee.cs.oswego.edu/dl/html/StreamParallelGuidance.html) — модель NQ.
- Joshua Bloch, «Effective Java», 3rd ed.: Item 48 «Use caution when making streams parallel».
