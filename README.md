#скрипты для Photoshop
Скрипт для автоматического ресайза изображений и/или добавления в них строчки текста, что бывает полезно при верстке отчетов.
 
#### образец файлика

`// комментарий comment line `   
`N37003gcrop.gif Фото 13. Карта мира`  
`N37003.gif Фото 13.2. Карта мира // только северное полушарие partially commented line`  
`img14.psd Фото 14. Группа у ложного тура на гребне, перевал КСС Казахстана на заднем плане`  
`img15.psd Фото 15. Спуск на ледник Обручева`  

#### useful commands
`chcp 1251`  
`dir /b/w *.jpg > list.txt`

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
