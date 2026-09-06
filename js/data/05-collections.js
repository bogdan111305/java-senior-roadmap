/* Section 5: Коллекции (Java Collections Framework) */
S("Коллекции (Java Collections Framework)", "Одна из самых объёмных и часто спрашиваемых тем — важно знать внутреннее устройство", [
  T("Иерархия коллекций", "Общая карта интерфейсов JCF.", [
    G("Структура", ["Collection → List / Set / Queue (и Deque)", "Map — отдельная параллельная иерархия (не наследует Collection)", "Iterable — базовый интерфейс для for-each, содержит iterator()"])
  ]),
  T("List: ArrayList, LinkedList, Vector", "Разное внутреннее устройство — разная сложность операций.", [
    G("ArrayList", ["Внутри — динамический массив Object[]", "resize: при заполнении создаётся новый массив в 1.5x больше, данные копируются", "get(index) — O(1), add в конец — амортизированная O(1), add/remove в середине — O(n)"]),
    G("LinkedList", ["Двусвязный список узлов (Node: prev, item, next)", "add/remove на концах — O(1), доступ по индексу — O(n)", "Реализует и List, и Deque одновременно"]),
    G("Устаревшие варианты", ["Vector и Stack — synchronized-варианты, вытеснены ArrayDeque/concurrent-коллекциями"])
  ]),
  T("Set: HashSet, LinkedHashSet, TreeSet", "Разные гарантии порядка и сложности.", [
    G("Реализации", ["HashSet построен поверх HashMap (элемент — ключ, значение — фиктивный объект-константа)", "LinkedHashSet — HashMap + двусвязный список для порядка вставки", "TreeSet — на основе TreeMap (красно-чёрное дерево), элементы отсортированы"]),
    G("API TreeSet/NavigableSet", ["floor/ceiling/higher/lower — поиск ближайшего элемента", "first/last, headSet/tailSet/subSet"])
  ]),
  T("Map: HashMap изнутри", "Топ-1 вопрос на собеседованиях по Java любого уровня — знать досконально.", [
    G("Внутреннее устройство", ["Массив бакетов Node<K,V>[] table, индекс = (n-1) & hash", "hash(key) дополнительно разбрасывает биты: h ^ (h >>> 16), чтобы уменьшить коллизии", "Коллизии внутри бакета — связный список узлов"]),
    G("Resize и treeify (Java 8+)", ["Load factor по умолчанию 0.75: resize при size > capacity*0.75", "При resize capacity удваивается, все элементы переразмещаются (rehash)", "TREEIFY_THRESHOLD = 8 — при накоплении 8+ элементов в бакете и capacity ≥ 64 список превращается в красно-чёрное дерево (O(n)→O(log n))", "UNTREEIFY_THRESHOLD = 6 — обратное превращение дерева в список при уменьшении"]),
    G("Родственные структуры", ["LinkedHashMap с accessOrder=true — LRU-порядок, основа для реализации LRU-кэша через removeEldestEntry", "TreeMap — сортированная карта на красно-чёрном дереве, O(log n) на операции", "Hashtable (legacy, synchronized) vs ConcurrentHashMap vs просто HashMap без синхронизации"]),
    G("Полезные методы", ["compute/computeIfAbsent/computeIfPresent/merge — атомарные (в однопоточном смысле) модификации значения", "getOrDefault, putIfAbsent"])
  ], "Как HashMap обрабатывает коллизии? Что изменилось в реализации HashMap в Java 8? Как реализовать LRU-кэш поверх LinkedHashMap?"),
  T("Queue и Deque", "Очереди разных видов и их применение.", [
    G("Реализации", ["PriorityQueue — бинарная куча (heap) на массиве, порядок по Comparator/natural order", "ArrayDeque — динамический циклический массив, быстрее LinkedList как стек/очередь", "BlockingQueue-реализации разбираются отдельно в разделе про многопоточность"])
  ]),
  T("Итераторы и модификация коллекций", "Частая причина рантайм-ошибок в реальном коде.", [
    G("Fail-fast vs fail-safe", ["Fail-fast (ArrayList, HashMap) — modCount проверяется, ConcurrentModificationException при изменении во время итерации", "Fail-safe (CopyOnWriteArrayList, ConcurrentHashMap) — итератор работает со снимком или не бросает исключение"]),
    G("Безопасная модификация", ["Iterator.remove() — единственный безопасный способ удалять во время итерации обычным итератором", "removeIf() как альтернатива в современном коде"])
  ]),
  T("Неизменяемые и утилитарные коллекции", "Современный подход к иммутабельности с Java 9+.", [
    G("Иммутабельность", ["List.of/Set.of/Map.of (Java 9+) — по-настоящему неизменяемые, бросают UnsupportedOperationException", "Collections.unmodifiableList — лишь обёртка, исходная коллекция всё ещё может измениться", "Arrays.asList — фиксированный размер, но элементы изменяемы, backed by массив"]),
    G("Утилиты", ["Collections.sort/reverse/shuffle/synchronizedList/emptyList", "Comparator и Collections.max/min"])
  ]),
  T("Выбор правильной коллекции", "Практический навык, который проверяют почти на любом собеседовании.", [
    G("Критерии выбора", ["Частое чтение по индексу → ArrayList; частые вставки в начало/середину → LinkedList/ArrayDeque", "Нужна уникальность без порядка → HashSet; с порядком вставки → LinkedHashSet; отсортированный → TreeSet", "Быстрый доступ по ключу → HashMap; сортировка по ключу → TreeMap; порядок вставки/LRU → LinkedHashMap"])
  ])
]);
