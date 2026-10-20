/* Section 19: Spring Data JPA */
S("Spring Data JPA", "Репозитории поверх JPA: как они устроены изнутри, запросы, пагинация, проекции, динамические фильтры, аудит и тесты слоя данных", [
  T("Репозитории: как работает интерфейс без реализации", "Сокращение boilerplate-кода для работы с БД поверх JPA — и механизм, который за этим стоит.", [
    G("Иерархия репозиториев", ["Repository → CrudRepository / ListCrudRepository → PagingAndSortingRepository → JpaRepository — что добавляет каждый уровень", "SimpleJpaRepository — готовая реализация save/findById/delete; save() вызывает persist или merge в зависимости от isNew()", "@Repository на интерфейсе-наследнике JpaRepository не нужен — трансляция исключений в DataAccessException работает и так"]),
    G("Под капотом: как работает интерфейс без единой строчки кода", ["Разработчик объявляет только интерфейс (extends JpaRepository) — реальная реализация создаётся на старте контекста как JDK dynamic proxy (или через SimpleJpaRepository + прокси-обёртку) — implementing-класса в исходниках нет", "Каждый вызов метода перехватывается RepositoryFactoryBeanSupport/QueryExecutorMethodInterceptor, который решает, какой запрос выполнить", "Query methods по имени: PartTree разбирает имя метода (findByLastNameAndAgeGreaterThan) на дерево условий (Part) ещё на старте приложения — если имя не разбирается по правилам, ошибка возникает сразу при запуске контекста, а не в рантайме на первом вызове", "Методы, унаследованные напрямую от JpaRepository (save/findById/deleteById), делегируются в SimpleJpaRepository — готовую реализацию Spring Data, а не генерируются заново"]),
    G("Конфигурация", ["@EnableJpaRepositories и автоконфигурация Spring Boot: где искать репозитории, своя базовая реализация", "bootstrap-mode DEFAULT / DEFERRED / LAZY — ускорение старта приложения"])
  ], "Как Spring создаёт реализацию репозитория, если в коде есть только интерфейс? Почему save() иногда выполняет SELECT перед INSERT?"),
  T("Запросы в репозиториях", "Derived-запросы, @Query и модифицирующие запросы.", [
    G("Derived-запросы", ["Query methods по имени метода — Spring парсит имя и строит запрос", "Ключевые слова: And/Or, Between, LessThan, Like/Containing, In, IsNull, OrderBy, First/Top, Distinct и префиксы exists/count/delete", "Слишком длинное имя метода — сигнал перейти на @Query или Specification"]),
    G("@Query", ["@Query с JPQL/native, именованные параметры (:param)", "countQuery для native-запросов с Pageable", "SpEL в запросах (#{#entityName}) и вызов хранимых процедур через @Procedure"]),
    G("@Modifying", ["@Modifying для UPDATE/DELETE в @Query — обязательно внутри транзакции", "clearAutomatically и flushAutomatically — что станет с persistence context после bulk-запроса", "Derived deleteBy… загружает сущности и удаляет по одной; массовое удаление — через @Modifying"])
  ], "Почему derived-метод deleteByStatus медленный на большой таблице? Зачем у @Modifying параметр clearAutomatically?"),
  T("Пагинация, сортировка и проекции", "Как выбирать данные порциями и только те поля, которые нужны.", [
    G("Пагинация", ["Pageable/Sort — встроенная пагинация и сортировка", "Page (с дополнительным COUNT-запросом) vs Slice (запрашивает на одну запись больше) vs Stream/Streamable", "Глубокая пагинация через OFFSET медленная — keyset-пагинация и Window/ScrollPosition (Spring Data 3.1)"]),
    G("Проекции", ["Projections (интерфейсные/DTO) — выборка только нужных полей без загрузки всей сущности", "Закрытые и открытые интерфейсные проекции: @Value со SpEL загружает сущность целиком", "Динамические проекции: <T> List<T> findBy…(Class<T> type)"])
  ], "Чем Page отличается от Slice? Почему OFFSET-пагинация медленная на дальних страницах?"),
  T("Загрузка связей и блокировки в репозиториях", "Как бороться с N+1 и управлять блокировками, не выходя за пределы репозитория.", [
    G("@EntityGraph", ["@EntityGraph(attributePaths = …) на методе репозитория против N+1", "@NamedEntityGraph, fetch graph vs load graph", "EntityGraph или JOIN FETCH коллекции вместе с Pageable — пагинация в памяти и предупреждение Hibernate в логе"]),
    G("@Lock и @QueryHints", ["@Lock(LockModeType.PESSIMISTIC_WRITE) — SELECT … FOR UPDATE из метода репозитория", "@QueryHints: таймаут блокировки, read-only, fetch size, кэш запросов", "Optimistic locking через @Version работает в save() автоматически"])
  ], "Как через Spring Data JPA взять строку на изменение с блокировкой и таймаутом?"),
  T("Динамические запросы и расширение репозиториев", "Фильтры из необязательных параметров и собственные реализации методов.", [
    G("Specifications", ["Specifications — композиция условий (and/or) поверх Criteria API", "JpaSpecificationExecutor и построение фильтра из необязательных параметров"]),
    G("Querydsl и Query by Example", ["QuerydslPredicateExecutor и предикаты на сгенерированных Q-классах", "Query by Example — поиск по образцу сущности для простых фильтров"]),
    G("Собственные реализации", ["Fragment-интерфейсы: интерфейс и класс с суффиксом Impl, подмешиваемый в репозиторий", "Своя базовая реализация для всех репозиториев (repositoryBaseClass)", "EntityManager или JdbcTemplate внутри фрагмента для запросов, которые неудобно выразить средствами Spring Data"])
  ], "Как сделать поиск по десятку необязательных фильтров без комбинаторного взрыва методов?"),
  T("Аудит и история изменений", "Кто и когда создал или изменил запись — без ручного кода в каждом сервисе.", [
    G("Spring Data JPA Auditing", ["@EnableJpaAuditing и AuditingEntityListener", "Auditing: @CreatedDate/@LastModifiedDate/@CreatedBy через @EnableJpaAuditing", "AuditorAware — текущий пользователь, обычно из Spring Security"]),
    G("Spring Data Envers", ["RevisionRepository и EnversRevisionRepositoryFactoryBean — история сущности через репозиторий", "findRevisions и findLastChangeRevision без ручной работы с AuditReader"])
  ], "Как реализовать автоматическое заполнение createdBy и историю изменений сущности?"),
  T("Тестирование слоя данных", "Как проверять репозитории и транзакции так, чтобы тест ловил реальные ошибки.", [
    G("Срезы и транзакции в тестах", ["@DataJpaTest — только JPA-слой, встроенная БД по умолчанию и откат после каждого теста", "@Transactional в тестах, @Rollback и @Commit, TransactionalTestExecutionListener", "TestEntityManager и flush() — без него тест может не дойти до SQL и пропустить ошибку"]),
    G("Реальная БД", ["Testcontainers с PostgreSQL вместо H2 — разные диалекты SQL и поведение ограничений", "@AutoConfigureTestDatabase(replace = NONE) и @ServiceConnection (Spring Boot 3.1)", "Проверка числа SQL-запросов в тестах как защита от N+1"])
  ], "Почему тест репозитория без flush() может пройти, а в проде код падает? Почему H2 в тестах — компромисс?")
]);
