/* Section 7: Функциональный стиль и Stream API (Java 8+) */
S("Функциональный стиль и Stream API (Java 8+)", "Изменил повседневный код на Java — обязателен для среднего и senior уровня", [
  T("Лямбда-выражения и замыкания", "Синтаксическая база функционального стиля в Java.", [
    G("Синтаксис", ["(args) -> expression или (args) -> { statements }", "Вывод типов параметров из контекста (target type)"]),
    G("Замыкания", ["@FunctionalInterface — интерфейс ровно с одним абстрактным методом", "Effectively final — переменные внешнего скоупа, захватываемые лямбдой, не должны изменяться после захвата", "Method references: Class::staticMethod, obj::instanceMethod, Class::new"])
  ]),
  T("Стандартные функциональные интерфейсы", "Набор готовых интерфейсов из java.util.function.", [
    G("Основные", ["Supplier<T> — get(), без аргументов", "Consumer<T> — accept(T), возвращает void", "Function<T,R> — apply(T) → R", "Predicate<T> — test(T) → boolean, комбинируется через and/or/negate"]),
    G("Дополнительные", ["BiFunction, BiConsumer, BiPredicate — с двумя аргументами", "UnaryOperator<T>/BinaryOperator<T> — Function/BiFunction с одинаковым типом входа и выхода", "Примитивные специализации (IntFunction, ToIntFunction, IntPredicate) — избегают автобоксинга"])
  ]),
  T("Stream API", "Декларативная обработка коллекций.", [
    G("Операции", ["Intermediate (ленивые, возвращают Stream): map, filter, sorted, distinct, flatMap, peek", "Terminal (запускают вычисление): collect, reduce, forEach, count, anyMatch/allMatch/noneMatch"]),
    G("Особенности", ["Ленивые вычисления: pipeline не выполняется, пока не вызван terminal-метод", "Short-circuit операции (limit, findFirst, anyMatch) — не обходят весь поток", "Стрим одноразовый — повторное использование бросает IllegalStateException"]),
    G("Под капотом: как на самом деле выполняется pipeline", ["Источник данных оборачивается в Spliterator (splittable iterator) — сочетает последовательный обход (tryAdvance) со способностью делить себя на части (trySplit) для параллельной обработки", "Каждая intermediate-операция не выполняется сама по себе, а оборачивает следующий этап в объект Sink — при вызове terminal-операции элементы проходят по цепочке Sink'ов ОДИН РАЗ (fusion/слияние стадий), а не поэтапно с материализацией промежуточных коллекций — поэтому map().filter().map() не создаёт трёх промежуточных списков", "Именно из этой модели «источник плюс цепочка Sink» вытекает лень: пока terminal-операция не запустит обход через Spliterator, ни один Sink не вызывается", "Stateless-операции (map, filter) обрабатывают элемент независимо от остальных и участвуют в единой цепочке; stateful-операции (sorted, distinct) вынуждены буферизовать весь поток перед тем, как отдать данные дальше — это разрывает «читай по одному элементу» модель и стоит памяти", "После того как terminal-операция исчерпала Spliterator источника, повторный обход невозможен — отсюда и IllegalStateException при повторном использовании стрима"])
  ], "Чем map отличается от flatMap? Почему поток можно обойти только один раз? Правда ли, что map().filter().map() создаёт промежуточные коллекции на каждом шаге?"),
  T("Collectors", "Финальная агрегация данных из потока.", [
    G("Базовые коллекторы", ["toList/toSet/toUnmodifiableList, toMap (с обработкой дублей ключей через merge-функцию)", "joining(delimiter, prefix, suffix)"]),
    G("Группировка", ["groupingBy(classifier) и groupingBy(classifier, downstream-коллектор)", "partitioningBy — специальный случай группировки по boolean-предикату", "summarizingInt/averagingInt/counting как downstream-коллекторы"]),
    G("Продвинутое", ["Свои коллекторы через Collector.of(supplier, accumulator, combiner, finisher)", "teeing (Java 12+) — объединение результатов двух коллекторов за один проход"])
  ]),
  T("Параллельные стримы", "Мощный, но опасный инструмент при неверном использовании.", [
    G("Механизм", ["parallelStream() делит источник данных (Spliterator) и использует ForkJoinPool.commonPool()", "Число потоков по умолчанию = число ядер процессора минус один"]),
    G("Риски", ["Накладные расходы на разбиение задачи могут превысить выигрыш на маленьких коллекциях", "Побочные эффекты (запись в общее изменяемое состояние) ломают корректность", "Блокирующие операции внутри parallelStream истощают общий пул для всего приложения"])
  ]),
  T("Optional", "Инструмент против NullPointerException — с частыми злоупотреблениями.", [
    G("Назначение и API", ["Явно показывает возможное отсутствие значения в возвращаемом типе", "orElse (всегда вычисляет аргумент) vs orElseGet (ленивый Supplier) vs orElseThrow", "map/flatMap/filter/ifPresent/ifPresentOrElse на Optional"]),
    G("Антипаттерны", ["Optional как поле класса или параметр метода — не по задумке дизайна", "Optional.get() без isPresent()-проверки — тот же риск, что и NPE", "Optional<Collection> вместо просто пустой коллекции"])
  ])
]);
