/* Section 4: Обработка исключений */
S("Обработка исключений", "Как Java сигнализирует об ошибках и как правильно на это реагировать", [
  T("Иерархия исключений", "Throwable, Error, Exception — что где ловить и почему.", [
    G("Иерархия", ["Throwable → Error (не для перехвата: OutOfMemoryError, StackOverflowError) и Exception", "Checked (наследники Exception, кроме RuntimeException) — обязаны быть объявлены или обработаны", "Unchecked (RuntimeException и наследники) — NullPointerException, IllegalArgumentException, ClassCastException"]),
    G("Проектирование", ["Checked — для восстановимых, ожидаемых ошибок (например, файл не найден)", "Unchecked — для программных ошибок и нарушений контракта метода"])
  ]),
  T("Механизм try-catch-finally", "Тонкости выполнения блоков — частая ловушка на собеседовании.", [
    G("Порядок выполнения", ["finally выполняется всегда, кроме System.exit() и краха JVM", "return в finally «перекрывает» return/exception из try", "Несколько catch — порядок от более специфичного к более общему"]),
    G("try-with-resources", ["Работает с любым AutoCloseable (close() вызывается автоматически)", "Ресурсы закрываются в порядке, обратном объявлению", "Подавленные исключения (suppressed) — если close() тоже бросил исключение, оно не теряется, а прикрепляется к основному"])
  ], "Что вернёт метод, если return есть и в try, и в finally? Как try-with-resources закрывает несколько ресурсов и в каком порядке?"),
  T("Свои исключения и best practices", "Проектирование иерархии исключений в реальных проектах.", [
    G("Создание", ["Наследование от Exception (checked) или RuntimeException (unchecked)", "Конструкторы с message и cause (exception chaining через super(cause))"]),
    G("Best practices", ["Антипаттерн: пустой catch-блок, глотающий ошибку", "Антипаттерн: catch (Exception e) слишком широко", "Логирование с сохранением стектрейса (не just e.getMessage())", "Не использовать исключения для управления обычным потоком выполнения"])
  ]),
  T("Исключения в многопоточном коде", "Особенности, которые не встречаются в однопоточном коде.", [
    G("Механизмы", ["Thread.setUncaughtExceptionHandler — обработка необработанных исключений в потоке", "Исключение в задаче ExecutorService «прячется» до вызова Future.get()", "CompletableFuture — исключение распространяется по цепочке до exceptionally/handle"])
  ])
]);
