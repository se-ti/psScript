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
//$.locale = 'ru';
$.localize = true; // автолокализация

/* todo
* проверять наличие файлика с описаниями
* высота больших? -- дать выбирать тип преобразования
* +- ввод путей руками
* output folder
* -- переделать layout на xml
* -+ запоминать настройки с прошлого запуска?  какие именно? try $.setenv / $.getenv   -- пока работает только пока не перезапустишь фотошоп

* ++ галочку для отключения ресайза и добавления текста
* ++ автоматически подтягивать единственный txt файл в папке
* ++ filenames with spaces -- просто возьми в кавычки
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

String.format = function() {
    var s = arguments[0];
    for (var i = 0; i < arguments.length - 1; i++) {
        var reg = new RegExp("\\{" + i + "\\}", "gm");
        s = s.replace(reg, arguments[i + 1]);
    }

    return s;
};

String._htmlSubstitutes = [{r:/&/gi, t:'&amp;'},
    {r:/</gi, t:'&lt;'},
    {r:/\>/gi, t:'&gt;'},
    {r:/'/gi, t:'&apos;'},
    {r:/"/gi, t:'&quot;'}];

String.toHTML = function(str)
{
    if (!str || ! str instanceof String)
        return '';

    var res = str;
    var arr = String._htmlSubstitutes;

    for (var i = 0; i < arr.length; i++)
        res = res.replace(arr[i].r, arr[i].t);
    return res;
};

CDialog =  function() {
    this.dlg = null;
    this._c = {

    };

    this.addWestraMarkup = false;
    this.srcFolder = null;

    var val = $.getenv(this._consts.envVar);
    this._lastPath = ((val || '') != '' && val != 'null') ? val : null;
};

CDialog.prototype = {

    _consts: {
      envVar: 'psScriptPath'
    },

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

        this.srcFolder = this._lastPath ? Folder(this._lastPath).selectDlg(title) : Folder.selectDialog(title);
        this.dlg.recursive.enabled = this.srcFolder instanceof Folder;
        this._canStart();

        this._setPathText(this.dlg.path, this.srcFolder);

        this._setPath(this.srcFolder ? (this.srcFolder instanceof Folder ? this.srcFolder.fullName : this.srcFolder.path) : null);
        this._guessDescription();
    },

    _setPath: function(path) {
        this._lastPath = path;
        $.setenv(this._consts.envVar, path);
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
            this._setPath(this.srcFolder.fullName);

        else if (path != '')
            alert(localize({en: 'Path "%1" doesn\'t exist!', ru: 'Папка "%1" не существует'}, path));

        this._guessDescription();
        this._canStart();
    },

    _guessDescription: function() {
        if (!this.srcFolder || this.dlg.recursive.value)
            return;

        var res = [];
        var files = this.srcFolder.getFiles();
        for (var i = 0; i < files.length; i++)
            if (files[i] instanceof File)
            {
                var dn = files[i].displayName;
                var ext = dn.slice(dn.lastIndexOf('.')).toLowerCase();
                if (dn == "descript.ion" || ext == '.txt')
                    res.push(dn);
            }

        if (res.length == 1) {
            this.dlg.desc.text = res[0];
            this._canAddText();
        }
    },

    _canStart: function() {
        this.dlg.btnPnl.buildBtn.enabled = this.srcFolder != null && (this.dlg.main.value || this.dlg.preview.value);
    },

    _canAddText: function () {
        var c = this.dlg;
        var val = c.main.value && ((c.desc.text || '') != '');
        c.addText.enabled = val;
        val = val && c.addText.value;
        c.textHeight.enabled = val;
        c.font.enabled = val;
    },

    _onMainChange: function(e) {
        var c = this.dlg;
        var val = c.main.value;

        c.resize.enabled = val;
        c.qual.enabled = val && c.psd.selection.index != 1;
        c.suffix.enabled = val;
        c.psd.enabled = val;
        this._canAddText();

        this._onResizeChange();
        this._canStart();
    },

    _onPreviewChange: function (e) {
        var c = this.dlg;
        var val = c.preview.value;

        c.resizePrev.enabled = val;
        c.prevQual.enabled = val;
        c.prevSuffix.enabled = val;

        this._onResizePreviewChange();
        this._canStart();
    },

    _onPsdChange: function (e) {
        this.dlg.qual.enabled = this.dlg.main.value && this.dlg.psd.selection.index != 1;
    },

    _onResizeChange: function(e) {
        var c = this.dlg;
        c.refDim.enabled = c.main.value && c.resize.value;
    },

    _onResizePreviewChange: function(e) {
        var c = this.dlg;
        c.prevRefDim.enabled = c.preview.value && c.resizePrev.value;
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
        var dim = c.resize.value ? this._limit(c.refDim, 1000, 1, null): 0;
        var param = c.main.value ? new CParam(dim, Math.round(qual * 12 / 100), c.suffix.text || '', CParam.prototype.ResizeMode.minSide) : null;

        qual = this._limit(c.prevQual, 75, 0, 100);
        dim = c.resizePrev.value ? this._limit(c.prevRefDim, 200, 1, null) : 0;
        var prevParam = c.preview.value ? new CParam(dim, qual, c.prevSuffix.text || '', CParam.prototype.ResizeMode.height) : null;    // CParam.prototype.ResizeMode.refSize

        if (c.font.selection != null) {
            param.font = app.fonts[c.font.selection.index]; //.getByName(c.font.selection.text);
            param.textHeight = c.addText.value ? this._limit(c.textHeight, 29, 0, 96) : 0;
        }

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

        var processor = new CImageProcessor(c.recursive.value, param, prevParam, c.psd.selection.index == 1);
        var logArr = processor.process(this.srcFolder, c.desc.text, function() { return app.breakProcess;} );

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
        var out2 = [];
        var list = [];
        var item;
        var len = logArr.length;
        var logPath = logFile.fsName.slice(0, logFile.fsName.lastIndexOf('\\'));
        var lpLen = logPath.length;

        for (var i = 0; i < len; i++) {
            out.push(logArr[i].toHTML(logPath, lpLen));
            out2.push(logArr[i].purikovItem());
            if ((item = logArr[i].imageListItem(logPath, lpLen)) != null)
                list.push(item);
        }

        dlg.logFile.open("a");
        dlg.logFile.write("<html>\n");
        dlg.logFile.write('<head> <!-- <meta http-equiv="content-type" content="text/html; charset=utf-8" /> --> </head>\n');
        dlg.logFile.write("<body>\n");
        dlg.logFile.write(out.join('<br/>\n'));
        dlg.logFile.write('<br/><br/>\n\n');
        if (this.addWestraMarkup && out2.length > 0)
        {
            dlg.logFile.write('<div class="zoom-gallery">\n\t');
            dlg.logFile.write(out2.join('<br/>\n\t'));
            dlg.logFile.write('\n</div><br/><br/>\n\n');
        }
        dlg.logFile.write(list.join('<br/>\n'));
        dlg.logFile.write("\n</body>\n</html>\n");
        dlg.logFile.close();
    },

    _adjustStatic: function (st) {
        if (st) {
            st.size = [92, 14];
            st.justify = 'right';
        }
    },

    _addSuffixControl: function(parent, defVal) {
        var rs = '';
        var row2 = parent.add('group');
        this._adjustStatic(row2.add('StaticText', undefined, this._L.suffix));
        var ctrl = row2.add('EditText', undefined, defVal);
        ctrl.characters = 6;
        return ctrl;
    },

    _addQualControl:function (parent, caption, defVal) {
        var rs = 'group {st: StaticText {text: "' + caption + '", justify: "right", size: [92, 14] },' +
            'ed: EditText { characters: 6, minvalue: 1, maxvalue: 100, text: "'+ defVal +'"}' +
            '}';

        return parent.add(rs).ed;
    },

    _initGUI: function() {
        var dlg = new Window(BridgeTalk.appName == "photoshop" ? 'dialog' : 'palette', 'Preview Builder v 0.4.0');
        this.dlg = dlg;

        dlg.alignChildren = 'fill';


        dlg.ctrlPnl = dlg.add('panel', undefined, {en: 'Source folder', ru: 'Папка с изображениями'});

        dlg.ctrlPnl.alignChildren = 'left';
        dlg.srcGrp = dlg.ctrlPnl.add('group');

        dlg.path = dlg.srcGrp.add('editText', undefined, ''); //, {readonly: false, borderless: true});
        dlg.path.characters = 40;
        dlg.path.onChange = $cd(this, this._onSrcFolderChanged);

        if (this._lastPath)
            dlg.path.text = File(this._lastPath).fsName;

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

        dlg.row_0 = dlg.TransformPnl.add('group');
        this._adjustStatic(dlg.row_0.add('StaticText', undefined, ''));
        dlg.resize = dlg.row_0.add('checkbox', undefined, {en: 'Resize', ru: 'Изменить размер'});
        dlg.resize.value = true;
        dlg.resize.onClick = $cd(this, this._onResizeChange);

        dlg.row0 = dlg.TransformPnl.add('group');
        this._adjustStatic(dlg.row0.add('StaticText', undefined, {en: 'Reference size:', ru: 'Размер:'}));
        dlg.refDim = dlg.row0.add('EditText', undefined, '1000');
        dlg.refDim.characters = 6;
        dlg.refDim.minvalue = 1;

        dlg.row3 = dlg.TransformPnl.add('group');
        this._adjustStatic(dlg.row3.add('StaticText', undefined, {en: 'Save as:', ru: 'Тип:'}));
        dlg.psd = dlg.row3.add('dropdownlist', undefined, ['JPEG', 'PSD']);
        dlg.psd.selection = 0;
        dlg.psd.onChange = $cd(this, this._onPsdChange);

        dlg.qual = this._addQualControl(dlg.TransformPnl, {en: 'Quality:', ru: 'Качество:'}, '100');

        dlg.row4__ = dlg.TransformPnl.add('group');
        this._adjustStatic(dlg.row4__.add('StaticText', undefined, ''));
        dlg.addText = dlg.row4__.add('checkbox', undefined, {en: 'Add text', ru: 'Добавить подпись'});
        dlg.addText.value = true;
        dlg.addText.onClick = $cd(this, this._canAddText);

        dlg.row4_ = dlg.TransformPnl.add('group');
        this._adjustStatic(dlg.row4_.add('StaticText', undefined, {en: 'Font size:', ru: 'Размер шрифта:'}));
        dlg.textHeight = dlg.row4_.add('EditText', undefined, '29');
        dlg.textHeight.characters = 6;

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

        dlg.row_0_ = dlg.settPnl.add('group');
        this._adjustStatic(dlg.row_0_.add('StaticText', undefined, ''));
        dlg.resizePrev = dlg.row_0_.add('checkbox', undefined, {en: 'Resize', ru: 'Изменить размер'});
        dlg.resizePrev.value = true;
        dlg.resizePrev.onClick = $cd(this, this._onResizePreviewChange);

        dlg.row4 = dlg.settPnl.add('group');
        this._adjustStatic(dlg.row4.add('StaticText', undefined, this._L.size));
        dlg.prevRefDim = dlg.row4.add('EditText', undefined, '200');
        dlg.prevRefDim.characters = 6;
        dlg.prevRefDim.minvalue = 1;

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

    save: function(doc, file, saveOrExport, psd)
    {
        if (!doc || !file)
            return;
        if (saveOrExport)
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

            case this.ResizeMode.height:
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

function CImageProcessor(recursive, param, prevParam, psd) {
    this._recursive = recursive;
    this._param = param;
    this._prevParam = prevParam;
    this._psd = psd;

    this._logArr = [];
}

CImageProcessor.prototype = {

    process: function(folder, descriptions, breakDelegate) {
        this._logArr = [];
        this._processFolder(folder, descriptions, breakDelegate);
        return this._logArr;
    },

    _processFolder: function(folder, descriptions, breakDelegate) {
        if (folder == null)
            return;

        if (folder instanceof File) {
            this._processFile(folder, null);
            return;
        }

        var files = this._getFolderFiles(folder, descriptions);
        if (!files)
            return;

        for (var i = 0; i < files.length; i++) {
            if (files[i].isFile())
                this._processFile(files[i].file, files[i].text);
            else if (this._recursive && files[i].isFolder())
                this._processFolder(files[i].file, descriptions, breakDelegate);

            if (breakDelegate && breakDelegate())
                break;
        }
    },

    _getFolderFiles: function(folder, descriptions) {
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

    _processFile: function (file, text) {
        if (!file.exists) {
            this._logArr.push(new LogItem(file.fsName, 'File doesn\'t exist'));
            return;
        }

        var ext = file.fullName.slice(file.fullName.lastIndexOf('.')).toLowerCase();
        if (ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".gif" || ext == ".bmp" || ext == ".psd") {
            var doc = app.open(file);
            app.activeDocument = doc;

            var item = new LogItem();
            if (this._param) {
                var state = doc.activeHistoryState;
                this._processImage(doc, file, this._param, item, true, text, this._psd);
                doc.activeHistoryState = state;
            }
            if (this._prevParam)
                this._processImage(doc, file, this._prevParam, item, false, null, false);

            doc.close(SaveOptions.DONOTSAVECHANGES);
            this._logArr.push(item);
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

    _processImage: function (doc, file, param, logItem, save, text, psd) {
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
    }
};

function LogItem(src, error) {
        this.error = error || '';
        this.src = src || '';

        this.alt = '';          // Фото 13.2. Южный склон пер. Озерный
        this.altTitle = '';     // Фото 13.2.
        this.text = '';         // Южный склон пер. Озерный

        this.preview = '';
        this.width = 0;
        this.height = 0;
}

LogItem.prototype = {

    addMain: function(src, alt)
    {
        this.src = src || '';
        this.alt = alt || '';

        var r = /^Фото [\d.]+\s*/gi;
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
        return path.toLowerCase().indexOf(logPath.toLowerCase()) == 0 ? ('./' + path.substring(logPathLen+1)).replace(/\\/gi, '/') : path;
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
                res += ' alt="' + String.toHTML(this.text) + '"';
            res += '/>'
        }
        //return head + res + tail;

        var alt = this.alt != '' ? ('\n\t\t\t<br>' + String.toHTML(this.alt)) : '';

        return '<table class="img" style="margin: auto;">\n\t<tr>\n\t\t<td>\n\t\t\t' + head + res + tail + alt + '\n\t\t</td>\n\t</tr>\n</table>';
    },

    imageListItem: function(logPath, pathLen)
    {
        if (this.alt == '' || this.src == '')
            return null;

        return String.format('{0}<a href="{1}" target="_blank">{2}</a>', String.toHTML(this.altTitle), this._relativePath(this.src, logPath, pathLen), String.toHTML(this.text));
    },

    purikovItem: function()
    {
        if (this.src == '')
            return '';

        var pos = this.src.lastIndexOf('\\');
        var name = pos >= 0 ? this.src.substring(pos+1) : this.src;
        pos = name.lastIndexOf('.');
        if (pos >= 0)
            name = name.substring(0, pos);

        return String.format('[[$ReportPhoto? &id=`{0}` &text=`{1}`]]', name, String.toHTML(this.alt));
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
