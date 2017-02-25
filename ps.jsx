/*
<javascriptresource>
    <name>Preview builder</name>
    <type>automate</type>
    <about>Generating report images. Serge Titov https://github.com/se-ti/</about>
</javascriptresource>
*/

#target photoshop
#script "Preview builder"

// $.level = 2;
// $.locale = 'ru';
$.localize = true; // автолокализация

/* todo
* автоматически подтягивать единственный txt файл в папке
* проверять наличие файлика с описаниями
* высота больших? -- дать выбирать тип преобразования
* +- ввод путей руками
* output folder
* переделать layout на xml
* запоминать настройки с прошлого запуска?  try $.setenv / $.getenv

* filenames with spaces -- просто возьми в кавычки
* ++ tooltips
* ++ прерываем выполнение
* ++ localization
* ++ font -- выбирать Calibri по умолчанию
* +- font setup, ?? а что не так?
* ++ text font size
* ++ нулевой размер запрещает ресайз или добавление текста
*/

function $cd(ctx, func) {
    if (!func || func.constructor != Function)
        return null;
    return function() {
        func.apply(ctx, arguments);
    };
}

CDialog =  function() {
    this.dlg = null;
    this._c = {

    };

    this.srcFolder = null;
    this._lastPath = null;
};

CDialog.prototype = {

    chooseFile: function() {
        var title = {en: 'Choose file to save log', ru: 'Выберите файл для лога'};
        var filter = {en: 'HTML files:*.html;*.htm,All files:*.*', ru:'HTML файлы:*.html;*.htm,Все файлы:*.*'};

        var dlg = this.dlg;
        if (dlg.logFile)
            dlg.logFile = dlg.logFile.openDlg(title, filter);
        else
            dlg.logFile = File.openDialog(title, filter);

        this._setPathText(dlg.logpath, dlg.logFile);
    },

    chooseFolder: function() {
        var title = {en: 'Choose folder to convert',
            ru: 'Выберите папку с обрабатываемыми изображениями'};

        this.srcFolder =  this._lastPath ? Folder(this._lastPath).selectDlg(title) : Folder.selectDialog(title);
        this.dlg.recursive.enabled = this.srcFolder instanceof Folder;
        this._canStart();

        this._setPathText(this.dlg.path, this.srcFolder);

        this._lastPath = this.srcFolder ? (this.srcFolder instanceof Folder ? this.srcFolder.fullName : this.srcFolder.path) : null;
    },

    _setPathText: function (ctrl, file) {
        ctrl.text = file ? file.fsName : '';
        ctrl.bounds.bottom = ctrl.bounds.top + 19;
    },

    _onSrcFolderChanged: function() {
        var path = this.dlg.path.text || '';
        var f = Folder(path);
        this.dlg.recursive.enabled = f.exists;
        this.srcFolder = f.exists ? f : null;
        if (f.exists)
            this._lastPath = this.srcFolder.fullName;
        else if (path != '')
            alert(localize({en: 'Path "%1" doesn\'t exist!', ru: 'Папка "%1" не существует'}, path));

        this._canStart();
    },

    _canStart: function() {
        this.dlg.btnPnl.buildBtn.enabled = this.srcFolder != null && (this.dlg.main.value || this.dlg.preview.value);
    },

    _canAddText: function () {
        var c = this.dlg;
        var val = c.main.value && ((c.desc.text || '') != '');
        c.textHeight.enabled = val;
        c.font.enabled = val;
    },

    _onMainChange: function(e) {
        var c = this.dlg;
        var val = c.main.value;

        c.refDim.enabled = val;
        c.qual.enabled = val && c.psd.selection.index != 1;
        c.suffix.enabled = val;
        c.psd.enabled = val;
        this._canAddText();

        this._canStart();
    },

    _onPreviewChange: function (e) {
        var c = this.dlg;
        var val = c.preview.value;

        c.prevRefDim.enabled = val;
        c.prevQual.enabled = val;
        c.prevSuffix.enabled = val;

        this._canStart();
    },

    _onPsdChange: function (e) {
        this.dlg.qual.enabled = this.dlg.main.value && this.dlg.psd.selection.index != 1;
    },

    _limit: function(control, defval, min, max) {
        var res = Number(control.text);
        if (isNaN(res))
            res = defval;

        if (max != null)
            res = Math.min(res, max);
        if (min != null)
            res = Math.max(res, min);
        control.text = res;

        return res;
    },

    start: function() {
        app.breakProcess = app._isRunning || false;
        if (app._isRunning)
            return;

        var c = this.dlg;
        var qual = this._limit(c.qual, 100, 0, 100);
        var dim = this._limit(c.refDim, 1000, 0, null);
        var param = c.main.value ? new CParam(dim, Math.round(qual * 12 / 100), c.suffix.text || '', CParam.prototype.ResizeMode.minSide) : null;

        qual = this._limit(c.prevQual, 75, 0, 100);
        dim = this._limit(c.prevRefDim, 200, 0, null);
        var prevParam = c.preview.value ? new CParam(dim, qual, c.prevSuffix.text || '', CParam.prototype.ResizeMode.refSize) : null;

        if (c.font.selection != null) {
            param.font = app.fonts[c.font.selection.index]; //.getByName(c.font.selection.text);
            param.textHeight = this._limit(c.textHeight, 29, 0, 96);
        }

        var logArr = [];

        var originalUnit = app.preferences.rulerUnits;
        var orgTypeUnit = app.preferences.typeUnits;
        var orgColor = app.backgroundColor;
        var bkCol = new SolidColor();
        bkCol.rgb = new RGBColor();

        preferences.rulerUnits = Units.PIXELS;
        preferences.typeUnits = TypeUnits.PIXELS;

        app.backgroundColor = bkCol;

        app._isRunning = true;
        c.btnPnl.buildBtn.text = this._L.interrupt;
        this.processFolder(this.srcFolder, c.recursive.value, param, prevParam, logArr, c.psd.selection.index == 1, c.desc.text);

        if (c.logFile)
            this.writeLog(c.logFile, logArr);
        app._isRunning = false;
        c.btnPnl.buildBtn.text = this._L.build;

        app.preferences.rulerUnits = originalUnit;
        app.preferences.typeUnits = orgTypeUnit;
        app.backgroundColor = orgColor;
        docRef = null;
    },

    writeLog: function(logFile, logArr) {
        var dlg = this.dlg;
        var out = [];
        var list = [];
        var item;
        var len = logArr.length;
        var logPath = logFile.fsName.slice(0, logFile.fsName.lastIndexOf('\\'));
        var lpLen = logPath.length;

        for (var i = 0; i < len; i++) {
            out.push(logArr[i].toHTML(logPath, lpLen));
            if ((item = logArr[i].imageListItem(logPath, lpLen)) != null)
                list.push(item);
        }

        dlg.logFile.open("a");
        dlg.logFile.write("<html>\n");
        dlg.logFile.write('<head> <!-- <meta http-equiv="content-type" content="text/html; charset=utf-8" /> --> </head>\n');
        dlg.logFile.write("<body>\n");
        dlg.logFile.write(out.join('<br/>\n'));
        dlg.logFile.write('<br/><br/>\n\n');
        dlg.logFile.write(list.join('<br/>\n'));
        dlg.logFile.write("\n</body>\n</html>\n");
        dlg.logFile.close();
    },

    processFolder: function(folder, recursive, param, prevParam, logItems, psd, descriptions) {
        if (folder == null)
            return;

        if (folder instanceof File) {
            this.processFile(folder, param, prevParam, logItems, psd, null);
            return;
        }

        var files = this.getFolderFiles(folder, descriptions);
        if (!files)
            return;

        for (var i = 0; i < files.length; i++) {
            if (files[i].isFile())
                this.processFile(files[i].file, param, prevParam, logItems, psd, files[i].text);
            else if (recursive && files[i].isFolder())
                this.processFolder(files[i].file, recursive, param, prevParam, logItems, psd, descriptions);

            if (app.breakProcess)
                break;
        }
    },

    getFolderFiles: function(folder, descriptions) {
        var res = [];
        if (!folder)
            return res;
        var scanFolder = true;

        if ((descriptions || '') != '') {
            var file;
            var desc = File(folder.fullName + '/' + descriptions);
            if (desc && desc.open("r")) {
                while (!desc.eof) {
                    var ln = desc.readln().replace(/(^\s*|\/\/.*)/gi, ''); // // is a comment
                    if ((ln || '') == '')
                        continue;

                    file = /^"[^~"]*"/gi.exec(ln);
                    if (file) {
                        ln = ln.substring(file[0].length).replace(/^\s+/, '');
                        file = file[0].substring(1, file[0].length-1)
                    }
                    else {
                        file = /^\S*/gi.exec(ln);
                        ln = ln.replace(/^\S*\s+/i, '');
                    }
                    res.push(new CFile(File(folder.fullName + '/' + file), ln));
                }
                desc.close();
                scanFolder = false;
            }
        }

        var files = folder.getFiles();
        for (var i = 0; i < files.length; i++) {
            if (scanFolder || !(files[i] instanceof File))
                res.push(new CFile(files[i], ''));
        }

        return res;
    },

    processFile: function (file, param, prevParam, logFile, psd, text) {
        if (!file.exists) {
            logFile.push(new LogItem(file.fsName, 'File doesn\'t exist'));
            return;
        }

        var ext = file.fullName.slice(file.fullName.lastIndexOf('.')).toLowerCase();
        if (ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".gif" || ext == ".bmp" || ext == ".psd") {
            var doc = app.open(file);
            app.activeDocument = doc;

            var item = new LogItem();
            if (param) {
                var state = doc.activeHistoryState;
                this.process(doc, file, param, item, true, text, psd);
                doc.activeHistoryState = state;
            }
            if (prevParam)
                this.process(doc, file, prevParam, item, false, null, false);

            doc.close(SaveOptions.DONOTSAVECHANGES);
            logFile.push(item);
        }
    },

    _addText: function(doc, param, text) {
        var newDpi = 300;
        if (doc.mode == DocumentMode.BITMAP || doc.mode == DocumentMode.INDEXEDCOLOR || doc.mode == DocumentMode.DUOTONE)
            doc.changeMode(ChangeMode.RGB);

        if (doc.bitsPerChannel == BitsPerChannelType.ONE)
            doc.bitsPerChannel = BitsPerChannelType.EIGHT;

        var pos = Number(doc.height);
        doc.resizeCanvas(null, Math.round(pos + param.textHeight * 3 / 2), AnchorPosition.TOPLEFT);
        doc.resizeImage(null, null, newDpi, ResampleMethod.NONE);

        var artLayerRef = doc.artLayers.add();
        artLayerRef.kind = LayerKind.TEXT;
        var textItemRef = artLayerRef.textItem;

        textItemRef.position = [0, Math.round(pos + param.textHeight * 1.1)];

        var uv = new UnitValue(param.textHeight, 'px');
        uv.baseUnit = UnitValue(1 / newDpi, 'in');					// todo а почему 300 dpi?
        textItemRef.size = uv.as('pt');
        textItemRef.antiAliasMethod = AntiAlias.SHARP;
        textItemRef.ligatures = true;
        if (param.font)
            textItemRef.font = param.font.postScriptName;
        textItemRef.contents = text;
    },

    process: function (doc, file, param, logItem, save, text, psd) {
        var fname = file.fullName.slice(0, file.fullName.lastIndexOf('.'));
        var logname = file.fsName.slice(0, file.fsName.lastIndexOf('.'));

        param.resize(doc);

        var hasText = save && (text || '') != '' && param.textHeight > 0;
        if (hasText)
            this._addText(doc, param, text);

        var ext = psd && save ? '.psd' : '.jpg';
//		alert(fname + param.suffix + ext);
        var outFile = new File(fname + param.suffix + ext);

        param.save(doc, outFile, save, psd);

        if (logItem) {
            if (save)
                logItem.addMain(logname + param.suffix + ext, text);
            else
                logItem.addPreview(logname + param.suffix + ext, Number(doc.width), Number(doc.height));
        }
    },

    _adjustStatic: function (st) {
        if (st) {
            st.size = [92, 14];
            st.justify = 'right';
        }
    },

    _addSuffixControl: function(parent, defVal)
    {
        var row2 = parent.add('group');
        this._adjustStatic(row2.add('StaticText', undefined, this._L.suffix));
        var ctrl = row2.add('EditText', undefined, defVal);
        ctrl.characters = 6;
        return ctrl;
    },

    _addQualControl:function (parent, caption, defVal) {
        var row = parent.add('group');
        this._adjustStatic(row.add('StaticText', undefined, caption));
        var res = row.add('EditText', undefined, defVal);
        res.characters = 6;
        res.minvalue = 1;
        res.maxvalue = 100;

        return res;
    },

    _initGUI: function() {
        var dlg = new Window(BridgeTalk.appName == "photoshop" ? 'dialog' : 'palette', 'Preview Builder v 0.3.1');
        this.dlg = dlg;

        dlg.alignChildren = 'fill';


        dlg.ctrlPnl = dlg.add('panel', undefined, {en: 'Source folder', ru: 'Папка с изображениями'});

        dlg.ctrlPnl.alignChildren = 'left';
        dlg.srcGrp = dlg.ctrlPnl.add('group');

        dlg.path = dlg.srcGrp.add('editText', undefined, ''); //, {readonly: false, borderless: true});	// , {readonly: false, borderless: true}
        dlg.path.characters = 40;
        dlg.path.onChange = $cd(this, this._onSrcFolderChanged);

        dlg.browseBtn = dlg.srcGrp.add('button', undefined, {en: 'Browse...', ru: 'Обзор...'});
        dlg.browseBtn.onClick = $cd(this, this.chooseFolder);

        dlg.recursive = dlg.ctrlPnl.add('checkbox', undefined, {en: 'Include all subfolders', ru: 'Включая все подпапки'});
        dlg.recursive.value = false;

        dlg.trow1 = dlg.ctrlPnl.add('group');
        this._adjustStatic(dlg.trow1.add('StaticText', undefined, {en: 'Descriptions:', ru: 'Описания:'}));
        dlg.desc = dlg.trow1.add('EditText', undefined, 'photo.txt');
        dlg.desc.characters = 15;
        dlg.desc.onChange = $cd(this, this._canAddText);

        // dst folder

        /*dlg.dest = dlg.add('panel', undefined, 'Destination folder');
        dlg.dest.alignChildren = 'left';
        dlg.dstGrp = dlg.dest.add('group');
        dlg.dstPath = dlg.dstGrp.add('EditText', undefined, '');
        dlg.dstPath.characters = 40;
        dlg.browseBtn2 = dlg.dstGrp.add('button', undefined, 'Choose...');
        dlg.browseBtn2.onClick = $cd(this, this.chooseFolder);
        */


        dlg.trow2 = dlg.add('group');
        dlg.trow2.align = 'fill';
        dlg.trow2.alignChildren = 'top';

        dlg.col1 = dlg.trow2.add('group');
        dlg.col1.orientation = 'column';
        dlg.col1.alignChildren = 'left';
        dlg.col1.align = 'left';
        dlg.col2 = dlg.trow2.add('group');
        dlg.col2.orientation = 'column';
        dlg.col2.align = 'right';
        dlg.col2.alignChildren = 'left';

        /*******************************************************/
        dlg.main = dlg.col1.add('checkbox', undefined, {en: 'Generate main', ru: 'Создать основные'});
        dlg.main.align = 'left';
        dlg.main.value = true;
        dlg.main.onClick = $cd(this, this._onMainChange);

        dlg.TransformPnl = dlg.col1.add('panel', undefined, '');
        dlg.TransformPnl.alignChildren = 'left';
        //dlg.TransformPnl.orientation = 'row';

        dlg.suffix = this._addSuffixControl(dlg.TransformPnl, '_r');

        dlg.row0 = dlg.TransformPnl.add('group');
        this._adjustStatic(dlg.row0.add('StaticText', undefined, {en: 'Reference size:', ru: 'Размер:'}));
        dlg.refDim = dlg.row0.add('EditText', undefined, '1000');
        dlg.refDim.characters = 6;
        dlg.refDim.minvalue = 1;
        dlg.refDim.helpTip = {en: '0 - don\'t resize', ru: '0 - не масштабировать'};

        dlg.row3 = dlg.TransformPnl.add('group');
        this._adjustStatic(dlg.row3.add('StaticText', undefined, {en: 'Save as:', ru: 'Тип:'}));
        dlg.psd = dlg.row3.add('dropdownlist', undefined, ['JPEG', 'PSD']);
        dlg.psd.selection = 0;
        dlg.psd.onChange = $cd(this, this._onPsdChange);

        dlg.qual = this._addQualControl(dlg.TransformPnl, {en: 'Quality:', ru: 'Качество:'}, '100');

        dlg.row4_ = dlg.TransformPnl.add('group');
        this._adjustStatic(dlg.row4_.add('StaticText', undefined, {en: 'Font size:', ru: 'Размер шрифта:'}));
        dlg.textHeight = dlg.row4_.add('EditText', undefined, '29');
        dlg.textHeight.characters = 6;
        dlg.textHeight.helpTip = {en: '0 - don\'t add text', ru: '0 - не добавлять подписи'};

        dlg.row5_ = dlg.TransformPnl.add('group');
        this._adjustStatic(dlg.row5_.add('StaticText', undefined, {en: 'Font name:', ru: 'Шрифт:'}));
        dlg.font = dlg.row5_.add('dropdownlist', undefined);

        var  selIndex = null;
        for (var i = 0; i < app.fonts.length; i++)
        {
            var name = app.fonts[i].name;
            if (selIndex == null && name == 'Calibri' || name == 'Century Gothic')
                selIndex = i;

            dlg.font.add('item', app.fonts[i].name);
        }
        dlg.font.selection = selIndex || 0;

        var t = this;
        dlg.textHeight.onChange = function() {t.dlg.font.enabled = t._limit(t.dlg.textHeight, 4, 0, 96) > 0; };

        /*******************************************************/

        dlg.preview = dlg.col2.add('checkbox', undefined, {en: 'Generate preview', ru: 'Создать превью'});
        dlg.preview.value = false;
        dlg.preview.onClick = $cd(this, this._onPreviewChange);

        dlg.settPnl = dlg.col2.add('panel', undefined, '');
        dlg.settPnl.alignChildren = 'left';

        dlg.prevSuffix = this._addSuffixControl(dlg.settPnl, '_prev');

        dlg.row4 = dlg.settPnl.add('group');
        this._adjustStatic(dlg.row4.add('StaticText', undefined, this._L.size));
        dlg.prevRefDim = dlg.row4.add('EditText', undefined, '200');
        dlg.prevRefDim.characters = 6;
        dlg.prevRefDim.minvalue = 1;
        dlg.prevRefDim.helpTip = {en: '0 - don\'t resize', ru: '0 - не масштабировать'};

        dlg.prevQual = this._addQualControl(dlg.settPnl, {en: 'JPEG quality:', ru: 'Качество:'}, '75');

        /*******************************************************/


        dlg.row7 = dlg.add('group'); //settPnl.
        dlg.log = dlg.row7.add('Button', undefined, {en: 'HTML log file...', ru: 'HTML лог-файл...'});
        dlg.logpath = dlg.row7.add('EditText', undefined, '', {readonly: true, borderless: true});
        dlg.logpath.characters = 50;
        dlg.log.onClick = $cd(this, this.chooseFile);

        dlg.btnPnl = dlg.add('group');
        dlg.btnPnl.alignment = 'center';
        dlg.btnPnl.buildBtn = dlg.btnPnl.add('button', undefined, this._L.build, {name: 'ok'});
        dlg.btnPnl.buildBtn.enabled = false;
        dlg.btnPnl.cancelBtn = dlg.btnPnl.add('button', undefined, {en: 'Cancel', ru: 'Отменить'}, {name: 'cancel'});

        dlg.btnPnl.buildBtn.onClick = $cd(this, this.start);
        dlg.btnPnl.cancelBtn.onClick = function () {
            app.breakProcess = true;
            dlg.close();
        };

        this._onMainChange();
        this._onPreviewChange();
        return dlg;
    },

     show: function() {
         this._initGUI();
         this.dlg.show();
     },

    _L: {	/*локализация*/
        build: {en: 'Build', ru: 'Запустить'},
        interrupt: {en: 'Break', ru: 'Прервать'},
        suffix: {en: 'Suffix:', ru: 'Суффикс:'},
        size: {en: 'Reference size:', ru: 'Размер:'}
    }
};

function CParam(dim, qual, suffix, mode) {
    this.dim = dim;
    this.quality = qual;
    this.suffix = suffix;
    this.resizeMode = mode;
}

CParam.prototype = {
    ResizeMode : {
        width: 1,
        height: 2,
        minSide : 3,
        maxSide : 4,
        refSize: 5
    },

    save: function(doc, file, save, psd)
    {
        if (!doc || !file)
            return;
        if (save)
        {
            var options;
            if (psd)
            {
                options = new PhotoshopSaveOptions();
                options.alphaChannels = true;
                options.annotations = true;
                options.embedColorProfile = true;
                options.layers = true;
                options.spotColors = true;	// what's it?
            }
            else
            {
                options = new JPEGSaveOptions();
                options.embedColorProfile = true;
                options.formatOptions = FormatOptions.STANDARDBASELINE;
                options.quality = this.quality;
            }
            doc.saveAs(file, options, true, Extension.LOWERCASE);
        }
        else
        {
            var op = new ExportOptionsSaveForWeb();
            op.format = SaveDocumentType.JPEG;
            op.includeProfile = false;
            op.quality = this.quality;
            doc.exportDocument(file, ExportType.SAVEFORWEB, op);
        }
    },

    resize: function(doc/*, mode, offset*/)
    {
        if (!doc || this.dim == 0)
            return;

        var newWidth = null;
        var newHeight = null;

        switch (this.resizeMode)
        {
            case this.ResizeMode.width:
            newWidth = this.dim;
            break;
            case this.ResizeMode.height: break;
                newHeight = this.dim;
                break;

            case this.ResizeMode.minSide:
                if (doc.width < doc.height)
                    newWidth = this.dim;
                else
                    newHeight = this.dim;
                break;

            case this.ResizeMode.maxSide:
                if (doc.width > doc.height)
                    newWidth = this.dim;
                else
                    newHeight = this.dim;
                break;

            case this.ResizeMode.refSize:
                newHeight = this.dim;
                if (doc.width > doc.height)
                    newHeight = Math.round(newHeight * 2 / 3);
                break;
        }

        /*if (newWidth != null && offset.width != null && newWidth - offset.Width > 0)
            newWidth -= offset.width;

        if (newHeight != null && offset.height != null && newHeight - offset.height > 0)
            newHeight -= offset.height;*/

        if ((newWidth == null || newWidth != null && newWidth < doc.width) && (newHeight == null || newHeight!= null && newHeight < doc.height))
            doc.resizeImage(newWidth, newHeight, undefined, ResampleMethod.BICUBIC);
    }
};

function LogItem(src, error) {
        this.error = error || '';
        this.src = src || '';
        this.alt = '';
        this.altTitle = '';
        this.text = '';

        this.preview = '';
        this.width = 0;
        this.height = 0;
}

LogItem.prototype = {

    addMain: function(src, alt)
    {
        this.src = src || '';
        this.alt = alt || '';

        var r = /^Фото \d+\.\s*/gi;
        var res = r.exec(this.alt);

        this.altTitle =  res? (res[0] || res ) : '';
        this.text = this.alt.substr(this.altTitle.length);
    },

    addPreview: function(src, width, height)
    {
        this.preview = src || '';
        this.width = width;
        this.height = height;
    },

    _relativePath: function(path, logPath, logPathLen)
    {
        return path.indexOf(logPath) == 0 ? ('./' + path.substring(logPathLen+1)).replace(/\\/gi, '/') : path;
    },

    toHTML: function(logPath, pathLen)
    {
        var res = '';
        var head = '';
        var tail = '';

        if (this.error != '')
            return 'Error: ' + this.error + ' ' + (this.src ||'');

        if (this.src != '')
        {
            head = '<a href="' + this._relativePath(this.src, logPath, pathLen) +  '" target="_blank">';
            tail = '</a>';
        }

        if (this.preview != '')
        {
            res = '<img src="' + this._relativePath(this.preview, logPath, pathLen) + '" width="' + this.width + '" height="' + this.height + '"';
            if (this.text != '')
                res += ' alt="' + this.text + '"';
            res += '/>'
        }
        //return head + res + tail;

        return '<table class="img" style="margin: auto;">\n\t<tr>\n\t\t<td>\n\t\t\t' + head + res + tail + (this.alt != '' ? '\n\t\t\t<br>' + this.alt : '') + '\n\t\t</td>\n\t</tr>\n</table>';
    },

    imageListItem: function(logPath, pathLen)
    {
        if (this.alt == '' || this.src == '')
            return null;

        return this.altTitle + '<a href="' + this._relativePath(this.src, logPath, pathLen) +  '" target="_blank">' + this.text + '</a>';
    }
};

function CFile(file, text) {
    this.file = file;
    this.text = text;
}
CFile.prototype = {
    isFile : function()
    {
        return this.file && (this.file instanceof File);
    },

    isFolder: function()
    {
        return this.file && !(this.file instanceof File) && this.file.name != "." && this.file.name != "..";
    }
};

(new CDialog()).show();
