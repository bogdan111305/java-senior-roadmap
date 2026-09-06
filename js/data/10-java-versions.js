/* Section 10: Эволюция Java: ключевые версии */
S("Эволюция Java: ключевые версии", "Senior обязан ориентироваться в фичах современных версий, а не только Java 8", [
  T("Java 8 — точка отсчёта", "Изменила стиль написания Java-кода навсегда.", [
    G("Ключевые фичи", ["Lambda-выражения и функциональные интерфейсы", "Stream API для декларативной обработки данных", "java.time (LocalDate/LocalDateTime/ZonedDateTime/Duration/Period) — неизменяемая и потокобезопасная замена Date/Calendar", "Default- и static-методы в интерфейсах", "Optional<T>"])
  ]),
  T("Java 9–11", "Модульность и обновление стандартного API.", [
    G("Платформа", ["JPMS (Java Platform Module System) — module-info.java, инкапсуляция пакетов между модулями", "JShell — интерактивный REPL для быстрых экспериментов"]),
    G("Синтаксис и API", ["var для локальных переменных (Java 10) — вывод типа, не «динамическая типизация»", "Новый HTTP Client (java.net.http, Java 11) — поддержка HTTP/2 и асинхронности из коробки", "Java 11 — LTS-версия, часто база для legacy-проектов"])
  ]),
  T("Java 12–17", "Существенное упрощение синтаксиса для типовых конструкций.", [
    G("Синтаксис", ["Switch expressions (Java 14) — switch как выражение со стрелочным синтаксисом, без fall-through", "Text blocks (Java 15) — многострочные строковые литералы \"\"\"...\"\"\"", "Pattern matching for instanceof — совмещает проверку типа и приведение"]),
    G("Records и sealed classes", ["Record (Java 16) — неизменяемый value-объект: конструктор, геттеры, equals/hashCode/toString генерируются автоматически", "Sealed classes/interfaces (Java 17) — явно ограниченный список разрешённых наследников (permits)", "Комбинация sealed + pattern matching даёт компилятору исчерпывающую проверку веток"])
  ], "Чем record отличается от обычного класса с геттерами? Зачем нужны sealed classes и как они сочетаются с switch?"),
  T("Java 21 (LTS) и далее", "Актуальная база для собеседований в 2025–2026.", [
    G("Ключевые фичи", ["Virtual threads (Project Loom) — лёгкие потоки для массового IO-bound параллелизма", "Pattern matching for switch и record patterns — деструктуризация record прямо в case", "Sequenced collections — единый интерфейс getFirst/getLast/reversed для List/Deque/LinkedHashSet/LinkedHashMap", "Structured concurrency (в развитии, preview/incubator в разных версиях)"])
  ])
]);
