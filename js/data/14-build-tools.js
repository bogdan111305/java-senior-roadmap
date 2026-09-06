/* Section 14: Инструменты сборки */
S("Инструменты сборки", "Экосистема вокруг компиляции и управления зависимостями", [
  T("Maven", "Самый распространённый build-инструмент в корпоративной Java.", [
    G("Жизненный цикл", ["validate → compile → test → package → verify → install → deploy", "Плагины привязываются к фазам жизненного цикла"]),
    G("Структура проекта", ["pom.xml: coordinates (groupId/artifactId/version), dependencies, build", "Scope зависимостей: compile (по умолчанию), provided, runtime, test, system", "Multi-module проекты и родительский POM (наследование конфигурации и версий через dependencyManagement)"])
  ]),
  T("Gradle", "Более гибкая и быстрая альтернатива Maven.", [
    G("Основы", ["build.gradle на Groovy или build.gradle.kts на Kotlin DSL", "Задачи (tasks) и явные/неявные зависимости между ними (dependsOn)", "Инкрементальная сборка и кэширование задач — основная причина, почему Gradle быстрее Maven на больших проектах"])
  ]),
  T("Управление зависимостями", "Практический навык избегания dependency hell.", [
    G("Проблемы и решения", ["Транзитивные зависимости и конфликты версий (diamond dependency conflict)", "Разрешение конфликтов: nearest-wins в Maven, явное указание версии", "BOM (Bill of Materials) — согласованный набор версий для семейства библиотек (например, spring-boot-dependencies)", "Артефакторные репозитории: Nexus, Artifactory — приватное хранение и проксирование зависимостей"])
  ])
]);
