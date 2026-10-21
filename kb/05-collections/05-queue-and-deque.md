---
title: "Queue и Deque"
section: 5
section_title: "Коллекции (Java Collections Framework)"
topic_slug: "05-05-queue-and-deque"
roadmap_ref: "Раздел 5 → Queue и Deque"
status: not-started
tags: [collections, queue, deque, priorityqueue, arraydeque, heap]
related:
  - "05-01-collections-hierarchy"
  - "05-02-list-implementations"
  - "05-08-choosing-collection"
  - "08-07-concurrent-collections-and-atomics"
  - "34-01-complexity-analysis"
last_reviewed: null
---

Очереди встречаются в коде реже списков и карт, но вопросы про них любят за
то, что ответы проверяют понимание структур данных: как `PriorityQueue` держит
минимум за O(1), почему `ArrayDeque` быстрее `LinkedList` и `Stack` и чем
`offer` отличается от `add`. Сюда же относятся типовые задачи вроде top-K.

## Ключевые концепции

### Интерфейсы

#### Queue: исключение или специальное значение
`Queue` описывает очередь на обработку с операциями над головой. Для каждой
операции в интерфейсе по два метода: один бросает исключение при неудаче,
другой возвращает специальное значение. `add`/`remove`/`element` бросают
исключения, а `offer`/`poll`/`peek` возвращают `false` или `null`.

Разница существенна для ограниченных очередей: `add` в заполненную очередь
бросит `IllegalStateException`, а `offer` вернёт `false`. На пустой очереди
`poll` и `peek` возвращают `null`, поэтому большинство очередей не принимает
`null` в качестве элемента — иначе `null` из `poll` было бы не отличить от
пустоты.

```java
Queue<String> q = new ArrayDeque<>();
System.out.println("poll()=" + q.poll() + ", peek()=" + q.peek());
q.remove();    // перехвачено
q.element();   // перехвачено
```
```
poll()=null, peek()=null
remove(): java.util.NoSuchElementException
element(): java.util.NoSuchElementException
```
На пустой очереди «мягкие» методы вернули `null`, а «строгие» бросили
`NoSuchElementException`.

#### Deque: стек и очередь в одном интерфейсе
`Deque` (double-ended queue) расширяет `Queue` операциями с обоих концов:
`offerFirst`/`offerLast`, `pollFirst`/`pollLast`, `peekFirst`/`peekLast`. Он
заменяет сразу два типа: как очередь (FIFO) — `offer` в хвост и `poll` с
головы, как стек (LIFO) — `push` и `pop` с головы. Javadoc класса `Stack` прямо
рекомендует использовать вместо него `Deque`.

### Реализации

#### PriorityQueue: бинарная куча
`PriorityQueue` выдаёт элементы не в порядке добавления, а по приоритету: в
голове всегда минимальный элемент по естественному порядку или компаратору.
Внутри — бинарная куча на массиве: элемент с индексом `i` не больше своих
потомков `2i + 1` и `2i + 2`. Полностью отсортирован массив при этом не
бывает.

Отсюда сложности: `peek` — O(1), минимум лежит в ячейке 0; `offer` и `poll` —
O(log n), элемент «всплывает» или «тонет» по высоте кучи. `remove(Object)` и
`contains` — O(n). Итератор и `toString` обходят массив как есть, без
сортировки. Порядок равных элементов не гарантирован.

```java
PriorityQueue<Integer> pq = new PriorityQueue<>(List.of(42, 7, 19, 3, 25, 11));
System.out.println("toString (порядок массива-кучи): " + pq);
System.out.println("peek=" + pq.peek());
// poll в цикле до опустошения
PriorityQueue<String> byLen = new PriorityQueue<>(Comparator.comparingInt(String::length).reversed());
byLen.addAll(List.of("kiwi", "banana", "fig"));
System.out.println("с компаратором (длинные первыми): poll=" + byLen.poll());
```
```
toString (порядок массива-кучи): [3, 7, 11, 42, 25, 19]
peek=3
poll по очереди: 3 7 11 19 25 42
с компаратором (длинные первыми): poll=banana
```
`toString` показал массив кучи: минимум первым, но дальше не по порядку. Только
последовательные `poll` выдают элементы отсортированными. С обратным
компаратором куча становится max-кучей.

Классическое применение — top-K: k наибольших из большого потока за
O(n log k) по времени и O(k) по памяти. Держат min-кучу размера k: каждый новый элемент
добавляют, а если размер превысил k, выбрасывают минимум.
```java
static List<Integer> topK(int[] data, int k) {
    PriorityQueue<Integer> heap = new PriorityQueue<>();   // min-куча размера k
    for (int x : data) {
        heap.offer(x);
        if (heap.size() > k) heap.poll();                  // выбрасываем наименьший
    }
    List<Integer> result = new ArrayList<>(heap);
    result.sort(Comparator.reverseOrder());
    return result;
}
// topK(new int[]{5, 1, 9, 3, 7, 8, 2}, 3)
```
```
top-3: [9, 8, 7]
```
В куче всегда лежат k лучших элементов из уже просмотренных, а в голове —
худший из них, который первым вылетает при появлении более крупного.

#### ArrayDeque: циклический массив
`ArrayDeque` хранит элементы в массиве с двумя индексами — головы и хвоста,
которые двигаются по кругу. Добавление и удаление с обоих концов — O(1) без
сдвига элементов, а при заполнении массив расширяется: маленький — примерно
вдвое, большой — в полтора раза. Узлов, как у
`LinkedList`, нет, а значит нет и лишних объектов, и обход идёт по
непрерывной памяти.

Поэтому `ArrayDeque` быстрее `LinkedList` в роли очереди и быстрее `Stack` в
роли стека — у последнего вдобавок синхронизация на каждом вызове. Ограничения:
нет доступа по индексу и нельзя хранить `null`. `ArrayDeque` не
потокобезопасна; для очереди между потоками есть `BlockingQueue`.

```java
Deque<String> stack = new ArrayDeque<>();
stack.push("a"); stack.push("b"); stack.push("c");
System.out.println("стек: " + stack + ", pop=" + stack.pop());
Deque<String> queue = new ArrayDeque<>();
queue.offer("a"); queue.offer("b"); queue.offer("c");
System.out.println("очередь: " + queue + ", poll=" + queue.poll());
queue.offer(null);   // перехвачено
```
```
стек: [c, b, a], pop=c
очередь: [a, b, c], poll=a
ArrayDeque.offer(null): NPE
```
Один класс работает и как стек (`push`/`pop` с головы), и как очередь
(`offer` в хвост, `poll` с головы).

Сравнение на 2 млн операций (второй проход после прогрева):
```java
// очередь: n раз offer, затем poll до опустошения — ArrayDeque и LinkedList
// стек: n раз push, затем pop до опустошения — ArrayDeque и Stack
```
```
очередь 2 млн offer+poll: ArrayDeque 37 ms, LinkedList 150 ms
стек 2 млн push+pop:      ArrayDeque 44 ms, Stack 122 ms
```
`ArrayDeque` в обеих ролях быстрее в 3–4 раза: нет выделения узла на каждый
элемент и нет блокировок.

#### BlockingQueue и очереди для потоков
`BlockingQueue` добавляет к `Queue` блокирующие операции: `put` ждёт свободного
места, `take` ждёт появления элемента, а `offer` и `poll` с таймаутом ждут
ограниченное время. Это основа схемы producer-consumer и рабочих очередей пулов
потоков. Реализации — `ArrayBlockingQueue`, `LinkedBlockingQueue`,
`PriorityBlockingQueue`, `DelayQueue`, `SynchronousQueue` — разбираются в
разделе о многопоточности.

## Частые вопросы на собеседовании

**Q: Как устроена PriorityQueue и какая у неё сложность?**
A: Это бинарная куча на массиве: в ячейке 0 минимальный элемент, каждый
родитель не больше потомков. `peek` — O(1), `offer` и `poll` — O(log n),
`contains` и `remove(Object)` — O(n). Итератор не выдаёт элементы по порядку:
отсортированную последовательность дают только повторные `poll`.

**Q: Почему ArrayDeque лучше LinkedList и Stack?**
A: `ArrayDeque` — циклический массив: операции на концах O(1) без создания
объекта-узла на каждый элемент и с хорошей локальностью в памяти. `LinkedList`
тратит память и время на узлы, а `Stack` наследует синхронизированный `Vector`
и платит за блокировки. В замерах `ArrayDeque` быстрее обоих в несколько раз.

**Q: Чем offer отличается от add, а poll от remove?**
A: `add`, `remove` и `element` при неудаче бросают исключения, а `offer`, `poll`
и `peek` возвращают `false` или `null`. Для ограниченной очереди `offer` — способ
попытаться добавить без исключения. Поэтому очереди обычно запрещают `null`:
иначе `null` из `poll` было бы не отличить от пустой очереди.

**Q: Как найти k наибольших элементов в большом потоке данных?**
A: Держать min-кучу размера k: добавлять каждый элемент и, если размер превысил
k, выбрасывать минимум через `poll`. В конце в куче останутся k наибольших.
Время — O(n log k), память — O(k), и весь поток не нужно хранить или
сортировать.

## Ловушки и частые ошибки

#### Обход PriorityQueue как отсортированной коллекции
`for (x : pq)` и `pq.toString()` выдают порядок внутреннего массива кучи, а не
отсортированный. Код, который печатает или сохраняет очередь «по приоритету»
через итератор, выдаёт почти случайный порядок. Нужна отсортированная
последовательность — извлекают элементы через `poll` или сортируют копию.

#### Изменение приоритета элемента внутри кучи
Если у объекта, лежащего в `PriorityQueue`, поменялось поле, от которого зависит
компаратор, куча об этом не узнаёт и её инвариант нарушается: `poll` начнёт
возвращать не минимум. Элемент удаляют, меняют и добавляют заново.

#### null в очередях
`ArrayDeque`, `PriorityQueue` и все `BlockingQueue` бросают
`NullPointerException` при добавлении `null`. `LinkedList` его примет, и тогда
`poll`, вернувший `null`, нельзя отличить от пустой очереди. Для «пустых»
значений используют `Optional` или объект-заглушку.

## Связанные темы
- [Иерархия коллекций](01-collections-hierarchy.md) — место `Queue` и `Deque` в JCF.
- [List: ArrayList, LinkedList, Vector](02-list-implementations.md) — `LinkedList` как `Deque` и устаревший `Stack`.
- [Выбор правильной коллекции](08-choosing-collection.md) — сводная таблица сложностей.
- [Comparable и Comparator](../03-oop/07-comparable-comparator.md) — порядок элементов в `PriorityQueue`.
- Concurrent-коллекции и атомарные переменные (раздел 8) — `BlockingQueue` и producer-consumer.
- Алгоритмы (раздел 34) — куча и задачи top-K.

## Источники
- [javadoc java.util.PriorityQueue](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/PriorityQueue.html), [java.util.ArrayDeque](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayDeque.html), [java.util.Queue](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Queue.html).
- Robert Sedgewick, Kevin Wayne, «Algorithms», 4th ed.: раздел 2.4 «Priority Queues».
