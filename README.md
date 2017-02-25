#скрипты для Photoshop
Скрипт для автоматического ресайза изображений и/или добавления под них 1 строчки текста, что бывает полезно при верстке отчетов.

На вход скрипт берет директорию, и текстовый файл в формате "имя файла" - пробел - "текст с описанием", по строке на файл.

На выходе -- измененные изображения и, если был указан -- html файл с превью, ссылками на измененные изображения и списком изображений с подписями (список иллюстраций).

### запуск
Скрипт можно запустить 3 способами: 
1. Просто открыть в фотошопе (File / Open).  
2. Открыть как скрипт: File / Script / Browse.  
3. При регулярном использовании удобно будет положить скрипт в специальную папочку Presets\Scripts в папке фотошопа (у меня -- "C:\Program Files\Adobe\Adobe Photoshop CS5 (64 Bit)\Presets\Scripts"\), перезапустить Фотошоп, и далее запускать скрипт через меню File / Script / Preview Builder 

#### образец файлика

`// комментарий comment line `  
`N37003gcrop.gif Фото 13. Карта мира`  
`N37003.gif Фото 13.2. Карта мира // только северное полушарие partially commented line`  
`"img15 45.psd" Фото 15. имя файла с пробелом // filename with space`  
`img14.psd Фото 14. Группа у ложного тура на гребне, перевал КСС Казахстана на заднем плане`  
`img15.psd Фото 15. Спуск на ледник Обручева`


#### useful commands
Создание списка файлов для обработки:  
`chcp 1251`     
`dir /b/w *.jpg > list.txt`

chcp нужна, если в именах файлов встречаются русские буквы.

###Документация по API

Основная документация: __Scripting guide__ и __Photoshop JavaScript Reference__ лежат на сайте Adobe:  
http://www.adobe.com/devnet/photoshop/scripting.html

Второй важнейший pdf - __Javascript Tools Guide__
В частности, там есть главы про инструменты и программирование UI (ScriptUI programming model)  
http://wwwimages.adobe.com/content/dam/Adobe/en/devnet/scripting/pdfs/javascript_tools_guide.pdf

Указание на третью доку есть у Peter Kahrel http://www.kahrel.plus.com/indesign/scriptui.html  
и ведет опять в Adobe: https://indd.adobe.com/view/a0207571-ff5b-4bbf-a540-07079bd21d75 - оцените ссылку, без Kahrel'а шиш найдешь. 

[Блог Давида Барранча](http://www.davidebarranca.com/2012/10/scriptui-window-in-photoshop-palette-vs-dialog/)с примерами, чтобы было проще начать.

Но первые 2 ссылки -- ключевые.

Дока по командной строке windows:  
https://en.wikibooks.org/wiki/Windows_Batch_Scripting
