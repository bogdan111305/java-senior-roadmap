---
title: "Регулярные выражения (Pattern/Matcher)"
section: 2
section_title: "Java Core: синтаксис и базовые конструкции"
topic_slug: "02-07-regex"
roadmap_ref: "Раздел 2 → Регулярные выражения (Pattern/Matcher)"
status: not-started
tags: [regex, pattern, matcher, redos, lookaround]
related:
  - "02-06-strings"
  - "08-05-thread-pools"
  - "32-01-owasp-top-10"
last_reviewed: null
---

Тема часто недооценена по сравнению с коллекциями или многопоточностью, но
регулярно всплывает и в задачах на парсинг и валидацию, и в разборе
инцидентов, когда сервис «подвесило» регулярное выражение на пользовательском
вводе. На senior-уровне ждут не только синтаксиса, но и понимания стоимости
компиляции, backtracking и того, как ограничить время сопоставления.

## Ключевые концепции

### Основные классы

#### Pattern и Matcher
`Pattern.compile(regex)` превращает строку регулярного выражения в
скомпилированный объект — внутренний граф состояний, по которому идёт
сопоставление. Компиляция заметно дороже самого поиска, поэтому шаблон,
который используется многократно, компилируют один раз и хранят в `static
final` константе.

`Matcher` создаётся под конкретную строку (`pattern.matcher(input)`) и хранит
состояние поиска: позицию для следующего `find()`, последнее совпадение и
группы. Поэтому `Pattern` неизменяем и потокобезопасен, его можно разделять
между потоками, а `Matcher` — нет: он используется в одном потоке.

#### matches, find и lookingAt
У `Matcher` три способа сопоставления. `matches()` требует, чтобы шаблон
совпал со всей строкой целиком. `find()` ищет очередное совпадение где угодно в
строке и при повторных вызовах продолжает с места, где остановился.
`lookingAt()` требует совпадения с начала строки, но не до её конца.

#### Удобные методы String и их цена
`String.matches`, `replaceAll` и `split` избавляют от явного `Pattern`, но
каждый вызов заново компилирует регулярное выражение. В цикле или на горячем
пути — обработке каждого запроса или каждой строки файла — это заметная
нагрузка на CPU. В таких местах шаблон компилируют один раз.

У `split` есть исключение — быстрый путь без регулярных выражений. Если
разделитель — один символ, не являющийся метасимволом (`split(",")`), или
экранированный символ из двух знаков (`split("\\.")`), строка режется простым
поиском символа без создания `Pattern`. А вот `split(",\\s*")` или
`split("\\s+")` компилируют шаблон при каждом вызове.

### Синтаксис

#### Классы символов
`\d` — цифра, `\w` — символ слова (буквы, цифры, подчёркивание), `\s` —
пробельный символ; заглавные `\D`, `\W`, `\S` — их отрицания. Произвольный
набор задаётся в квадратных скобках: `[a-zA-Z0-9]`, отрицание — `[^...]`.

По умолчанию эти классы в Java ASCII-only: `\d` не совпадает с цифрами других
письменностей, а `\w` — с кириллицей. Чтобы они работали по правилам Unicode,
нужен флаг `Pattern.UNICODE_CHARACTER_CLASS` или встроенный флаг `(?U)`. Для
букв любого алфавита есть и класс `\p{L}`.

#### Квантификаторы: жадные, ленивые, притяжательные
Квантификаторы задают число повторений: `*` — ноль или больше, `+` — один или
больше, `?` — ноль или один, `{n,m}` — от n до m. По умолчанию они жадные
(greedy): захватывают максимум, а если остаток шаблона не совпал, отступают
назад (backtracking), уменьшая захват.

Суффикс `?` делает квантификатор ленивым (`*?`, `+?`): он захватывает минимум и
расширяется только при необходимости. Суффикс `+` делает его притяжательным
(`*+`, `++`): он захватывает максимум и никогда не отступает. Притяжательные
квантификаторы и атомарные группы `(?>...)` полностью исключают backtracking
для своей части шаблона.

#### Группы
Захватывающая группа `(...)` группирует элементы для квантификатора и
запоминает совпавший текст, к которому потом обращаются по номеру. Именованная
группа `(?<name>...)` делает то же с понятным именем. Незахватывающая группа
`(?:...)` только группирует, не запоминая текст и не занимая номер.

#### Lookahead и lookbehind
Опережающая и ретроспективная проверки (lookaround) проверяют условие, не
включая текст в совпадение. `X(?=Y)` — X, за которым следует Y; `X(?!Y)` — X, за
которым не следует Y. `(?<=Y)X` и `(?<!Y)X` — то же для текста перед X.

Типичные применения — найти число перед словом «руб» или после знака `$`, не
захватывая сам знак, и проверки паролей вида «есть хотя бы одна цифра»
(`(?=.*\d)`). Lookaround не потребляет символы, поэтому несколько проверок
подряд в начале шаблона накладывают независимые условия на одну и ту же
строку.

#### Якоря и флаги
Якоря задают позицию, а не символ: `^` — начало, `$` — конец, `\b` — граница
слова. Самые частые флаги — `CASE_INSENSITIVE`, `MULTILINE` (`^` и `$`
срабатывают на границах каждой строки текста) и `DOTALL` (`.` совпадает и с
переводом строки). Флаги можно встроить прямо в шаблон: `(?i)`, `(?m)`, `(?s)`.

### Практика

#### group(n), group("name"), groupCount()
После успешного сопоставления `group(n)` возвращает текст группы номер `n`
(нумерация с 1, а `group()` — всё совпадение), `group("name")` — текст
именованной группы. `groupCount()` возвращает число захватывающих групп, не
считая незахватывающие. С Java 9 `matcher.results()` возвращает поток всех
совпадений.

#### Замена и экранирование
`replaceAll` подставляет в замену текст групп через `$1`, `$2` или
`${name}`, что позволяет переставлять части совпадения. Обратная сторона — в
строке замены особый смысл имеют `$` и `\`: `replaceAll("10", "US$")` бросает
`IllegalArgumentException`, а `"$5"` при отсутствии пятой группы —
`IndexOutOfBoundsException`.

Пользовательский текст в замене экранируют через
`Matcher.quoteReplacement`, а в самом шаблоне — через `Pattern.quote`, который
делает строку литералом. С Java 9 есть ещё `replaceAll(Function<MatchResult,
String>)` — замена, вычисляемая по каждому совпадению.

#### split и пустые хвосты
`split(regex)` удаляет пустые строки в конце результата: `"a,b,,".split(",")`
даёт два элемента, а не четыре. Чтобы сохранить пустые хвосты, передают
отрицательный `limit`: `split(",", -1)`. Положительный `limit` ограничивает
число частей — последняя получит весь остаток строки.

#### Catastrophic backtracking (ReDoS)
Некоторые шаблоны с неоднозначной структурой заставляют движок перебирать
экспоненциально много способов разбить строку, прежде чем признать неудачу.
Классический учебный пример — вложенные квантификаторы `(a+)+b` на строке из
множества `a` без `b` в конце.

Движок OpenJDK (проверено на JDK 21) содержит оптимизацию именно против
вложенных квантификаторов такого вида, поэтому `(a+)+b` и `(a|aa)+b` на
практике не взрываются. Но проблема не решена в принципе: последовательность
независимых опциональных групп (`a?a?a?…aaa…`) даёт комбинаторный взрыв другой
природы, и на строке из 30 символов сопоставление идёт 15 секунд (замер в
примерах).

Защита — избегать неоднозначных перекрывающихся конструкций, особенно когда
шаблон или текст приходит от пользователя. Помогают притяжательные
квантификаторы и атомарные группы, ограничение длины входа и ограничение
времени сопоставления. Такие атаки называют ReDoS — Regular Expression Denial
of Service.

#### Ограничение времени сопоставления
У `java.util.regex` нет встроенного таймаута, а `Matcher` не проверяет флаг
прерывания потока. Поэтому запуск в пуле и `future.cancel(true)` не помогают:
`get()` вернёт управление, а поток пула продолжит перебирать варианты и жечь CPU.

Рабочий приём — передать в `matcher()` собственную реализацию
`CharSequence`, которая в `charAt()` сверяется с дедлайном и бросает
исключение. Движок постоянно читает символы через `charAt()`, так что
исключение прервёт сопоставление изнутри. Другой вариант — движки с линейной
сложностью без backtracking (например, RE2/J), но у них нет обратных ссылок и
lookaround.

## Примеры

`find`, `matches` и `lookingAt`:
```java
Pattern p = Pattern.compile("\\d+");
Matcher m1 = p.matcher("id: 42, qty: 7");
while (m1.find()) {
    System.out.println("найдено: " + m1.group() + " на позиции " + m1.start() + "-" + m1.end());
}
System.out.println("matches() на 'id: 42, qty: 7': " + p.matcher("id: 42, qty: 7").matches());
System.out.println("matches() на '12345': " + p.matcher("12345").matches());
System.out.println("lookingAt() на 'id: 42': " + p.matcher("id: 42").lookingAt());
System.out.println("lookingAt() на '42abc': " + p.matcher("42abc").lookingAt());
```
```
найдено: 42 на позиции 4-6
найдено: 7 на позиции 13-14
matches() на 'id: 42, qty: 7': false
matches() на '12345': true
lookingAt() на 'id: 42': false
lookingAt() на '42abc': true
```

Именованные и незахватывающие группы:
```java
Pattern datePattern = Pattern.compile("(?<year>\\d{4})-(?:\\d{2})-(?<day>\\d{2})");
Matcher m2 = datePattern.matcher("2026-09-10");
if (m2.matches()) {
    System.out.println("year=" + m2.group("year") + " day=" + m2.group("day"));
    System.out.println("groupCount()=" + m2.groupCount());
}
```
```
year=2026 day=10
groupCount()=2
```
Месяц сопоставился, но группа незахватывающая, поэтому групп две, а не три.

Перестановка частей через обратные ссылки:
```java
String swapped = "2026-09-10".replaceAll("(\\d{4})-(\\d{2})-(\\d{2})", "$3.$2.$1");
System.out.println("swapped: " + swapped);
```
```
swapped: 10.09.2026
```

Жадный и ленивый квантификатор:
```java
Pattern greedy = Pattern.compile("<.+>");
Pattern lazy = Pattern.compile("<.+?>");
String html = "<b>bold</b>";
System.out.println("greedy <.+>: " + greedy.matcher(html).results().findFirst().get().group());
System.out.println("lazy <.+?>: " + lazy.matcher(html).results().findFirst().get().group());
```
```
greedy <.+>: <b>bold</b>
lazy <.+?>: <b>
```

Lookaround, экранирование, `split` и Unicode:
```java
System.out.println("lookahead (?= руб): " + Pattern.compile("\\d+(?= руб)").matcher("цена 300 руб, скидка 50%").results().map(MatchResult::group).toList());
System.out.println("lookbehind (?<=\\$): " + Pattern.compile("(?<=\\$)\\d+").matcher("стоит $42, а не 42").results().map(MatchResult::group).toList());
System.out.println("negative lookahead, нет цифр: secret -> " + "secret".matches("(?!.*\\d).+") + ", s3cret -> " + "s3cret".matches("(?!.*\\d).+"));

"price: 10".replaceAll("10", "US$");   // перехвачено
"price: 10".replaceAll("10", "$5");    // перехвачено
System.out.println("quoteReplacement: " + "price: 10".replaceAll("10", Matcher.quoteReplacement("$5")));
System.out.println("split(\".\"): " + "a.b.c".split(".").length + " элементов, split(Pattern.quote(\".\")): " + "a.b.c".split(Pattern.quote(".")).length);
System.out.println("\"a,b,,\".split(\",\"): " + Arrays.toString("a,b,,".split(",")) + ", с limit -1: " + Arrays.toString("a,b,,".split(",", -1)));

String arabicThree = "٣";   // арабско-индийская цифра 3
System.out.println("\\d и цифра " + arabicThree + ": " + arabicThree.matches("\\d")
        + ", с UNICODE_CHARACTER_CLASS: " + Pattern.compile("\\d", Pattern.UNICODE_CHARACTER_CLASS).matcher(arabicThree).matches());
System.out.println("\\w+ и \"привет\": " + "привет".matches("\\w+") + ", (?U)\\w+: " + "привет".matches("(?U)\\w+"));
```
```
lookahead (?= руб): [300]
lookbehind (?<=\$): [42]
negative lookahead, нет цифр: secret -> true, s3cret -> false
replaceAll("US$") -> IllegalArgumentException: Illegal group reference: group index is missing
replaceAll("$5") -> IndexOutOfBoundsException: No group 5
quoteReplacement: price: $5
split("."): 0 элементов, split(Pattern.quote(".")): 3
"a,b,,".split(","): [a, b], с limit -1: [a, b, , ]
\d и цифра ٣: false, с UNICODE_CHARACTER_CLASS: true
\w+ и "привет": false, (?U)\w+: true
```
`split(".")` вернул пустой массив: точка совпала с каждым символом, все части
оказались пустыми, а пустые хвосты удаляются. `\w` по умолчанию не считает
кириллицу символами слова.

Экспоненциальный рост времени на опциональных группах:
```java
// k независимых опциональных групп "a?" перед k обязательных "a"
for (int k = 10; k <= 30; k += 2) {
    String regex = "a?".repeat(k) + "a".repeat(k);
    String input = "a".repeat(k) + "X"; // не хватает одного символа -> полный перебор перед провалом
    long start = System.currentTimeMillis();
    boolean result = Pattern.compile(regex).matcher(input).matches();
    System.out.println("k=" + k + " result=" + result + " elapsed=" + (System.currentTimeMillis() - start) + "ms");
}
```
```
k=10 result=false elapsed=1ms
...
k=16 result=false elapsed=5ms
...
k=20 result=false elapsed=13ms
...
k=24 result=false elapsed=216ms
k=26 result=false elapsed=904ms
k=28 result=false elapsed=3711ms
k=30 result=false elapsed=14672ms
```
(Строки для k=12, 14, 18 и 22 пропущены.) Время примерно удваивается с каждым
шагом `k` на 2 — сигнатура экспоненциального роста. Вход короче 40 символов, а
поток занят почти 15 секунд.

Тот же шаблон с дедлайном 100 мс через обёртку над `CharSequence`:
```java
record DeadlineCharSequence(CharSequence inner, long deadlineNanos) implements CharSequence {
    public char charAt(int index) {
        if (System.nanoTime() > deadlineNanos)
            throw new IllegalStateException("regex timeout");
        return inner.charAt(index);
    }
    public int length() { return inner.length(); }
    public CharSequence subSequence(int s, int e) {
        return new DeadlineCharSequence(inner.subSequence(s, e), deadlineNanos);
    }
    public String toString() { return inner.toString(); }
}

int k = 30;
Pattern evil = Pattern.compile("a?".repeat(k) + "a".repeat(k));
String input = "a".repeat(k) + "X";
long start = System.nanoTime();
try {
    evil.matcher(new DeadlineCharSequence(input, start + 100_000_000L)).matches(); // 100 мс
} catch (IllegalStateException e) {
    System.out.println(e.getMessage() + " после " + (System.nanoTime() - start) / 1_000_000 + " мс");
}
```
```
regex timeout после 100 мс
```
Сопоставление прервалось ровно по дедлайну, в том же потоке и без пула. Цена —
проверка `System.nanoTime()` на каждое чтение символа, что для валидации
пользовательского ввода обычно приемлемо.

## Частые вопросы на собеседовании

**Q: Чем find() отличается от matches()?**
A: `matches()` требует совпадения со всей строкой, будто шаблон обёрнут в
`^...$`. `find()` ищет совпадение где угодно и при повторных вызовах
продолжает с позиции предыдущего. Есть и третий вариант — `lookingAt()`,
привязанный к началу строки, но не требующий совпадения до конца.

**Q: Почему регулярное выражение стоит компилировать один раз?**
A: Компиляция строит граф состояний и стоит заметно дороже поиска. `String.matches`,
`replaceAll` и `split` компилируют шаблон при каждом вызове (кроме `split` по
одному простому символу), что на горячем пути превращается в лишнюю нагрузку.
`Pattern` неизменяем и потокобезопасен, поэтому его держат в `static final`
константе, а `Matcher` создают под каждую строку.

**Q: Что такое ReDoS и как от него защититься?**
A: Это отказ в обслуживании через регулярное выражение с экспоненциальным
backtracking: короткая специально подобранная строка занимает поток на секунды
или минуты. Защита — шаблоны без неоднозначных перекрывающихся частей,
притяжательные квантификаторы и атомарные группы, ограничение длины ввода и
времени сопоставления. `Future.cancel` здесь не помогает, потому что `Matcher`
не реагирует на прерывание.

**Q: Как безопасно вставить пользовательскую строку в шаблон или замену?**
A: В шаблон — через `Pattern.quote`, который делает строку литералом без
метасимволов. В строку замены — через `Matcher.quoteReplacement`, иначе `$` и
`\` будут интерпретированы как ссылки на группы и экранирование.

## Ловушки и частые ошибки

#### Перекомпиляция Pattern в цикле
`String.matches` или `replaceAll` в методе, вызываемом на каждый запрос, на
маленьком объёме незаметны, а на горячем пути дают реальную просадку. Лечится
выносом `Pattern.compile` в константу.

#### «Регулярки безопасны для любого ввода»
Даже шаблон без явно «страшных» вложенных квантификаторов может дать
экспоненциальный рост на входе в пару десятков символов. На непроверенный ввод
закладывают ограничение длины и времени, а не надеются, что движок «сам
разберётся».

#### $ и \ в строке замены
`replaceAll` трактует `$` и `\` в замене как специальные символы. Строка с
ценой в долларах или путём Windows из пользовательских данных обрушит замену
исключением или испортит результат. Нужен `Matcher.quoteReplacement` или
обычный `replace` без регулярных выражений.

#### \w и \d только для ASCII
Валидация имени шаблоном `\w+` отвергает «Иван», а `\d` не узнаёт цифры других
письменностей. Для Unicode-текста нужен флаг `UNICODE_CHARACTER_CLASS` или
классы `\p{L}` и `\p{Nd}`.

## Связанные темы
- [Строки](06-strings.md) — `split`, `replaceAll` и `matches` поверх `Pattern`.
- Пулы потоков (раздел 8) — почему прерывание не останавливает код, который не проверяет флаг interrupt.
- OWASP Top 10 (раздел 32) — ReDoS как вариант отказа в обслуживании.

## Источники
- [javadoc java.util.regex.Pattern](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/regex/Pattern.html) — полный синтаксис и флаги.
- Jeffrey Friedl, «Mastering Regular Expressions» — устройство движков с backtracking.
- [OWASP: Regular expression Denial of Service — ReDoS](https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS).
