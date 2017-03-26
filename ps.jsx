/*
<javascriptresource>
    <name>Preview builder</name>
    <type>automate</type>
    <about>Generating report images. Serge Titov https://github.com/se-ti/</about>
</javascriptresource>
*/

#target photoshop
#script "Preview builder"

//$.level = 2;
//$.locale = 'ru';
$.localize = true; // автолокализация

/* todo
* проверять наличие файлика с описаниями
* высота больших? -- дать выбирать тип преобразования
* +- ввод путей руками
* output folder
* --+ переделать layout на xml
* -+ запоминать настройки с прошлого запуска?  какие именно? try $.setenv / $.getenv   -- пока работает только пока не перезапустишь фотошоп

* ++ галочка "верстка под вестру"?
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

if (String.prototype.trim == null)
    String.prototype.trim = function() 
    {
        return this.replace(/^\s*/, '').replace(/\s*$/, '');
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

    this.srcFolder = null;

    var val = $.getenv(this._consts.envVar);
    this._lastPath = ((val || '') != '' && val != 'null') ? val : null;
    if (this._lastPath && (val = Folder(this._lastPath)) instanceof Folder)
        this.srcFolder = val;
    else
        this._lastPath = null;
};

CDialog.prototype = {

    _consts: {
      envVar: 'psScriptPath'
    },

    chooseFile: function() {
        var title = {en: 'Choose file to save log', ru: 'Выберите файл для лога'};
        var filter = {en: 'HTML files:*.html;*.htm,All files:*.*', ru:'HTML файлы:*.html;*.htm,Все файлы:*.*'};

        var dlg = this.dlg;
        if (dlg.logFile || this.srcFolder)
            dlg.logFile = (dlg.logFile || this.srcFolder).openDlg(title, filter);
        else
            dlg.logFile = File.openDialog(title, filter);

        this._setPathText(dlg.logpath, dlg.logFile);
		
		dlg.useWestra.enabled = dlg.logFile != null;
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

    _canAddText: function() {
        this.main.canAddText((this.dlg.desc.text||'') != '');
    },

    _canStart: function() {
        this.dlg.btnPnl.buildBtn.enabled = this.srcFolder != null && (this.dlg.main.value || this.dlg.preview.value);
    },    

    _onMainChange: function(e) {
        this.main.setEnabled(this.dlg.main.value);
        this._canStart();
    },

    _onPreviewChange: function (e) {
        this.preview.setEnabled(this.dlg.preview.value);
        this._canStart();
    },

    start: function() {
        app.breakProcess = app._isRunning || false;
        if (app._isRunning)
            return;

        var state = this._updatePSState();

        app._isRunning = true;
        var c = this.dlg;
        c.btnPnl.buildBtn.text = this._L.interrupt;

        var param  = c.main.value ?  this.main.getParam() : null;
        var prevParam  = c.preview.value ?  this.preview.getParam() : null;
        var processor = new CImageProcessor(c.recursive.value, param, prevParam,  this.main.isPsd());
        var logArr = processor.process(this.srcFolder, c.desc.text, function() { return app.breakProcess;} );

        if (c.logFile)
            this.writeLog(c.logFile, logArr);

        app._isRunning = false;
        c.btnPnl.buildBtn.text = this._L.build;

        this._restorePSState(state);
    },

    _updatePSState: function() {

        var res = {
            originalUnit: app.preferences.rulerUnits,
            orgTypeUnit: app.preferences.typeUnits,
            orgColor: app.backgroundColor
        };

        var bkCol = new SolidColor();
        bkCol.rgb = new RGBColor();
        app.backgroundColor = bkCol;

        preferences.rulerUnits = Units.PIXELS;
        preferences.typeUnits = TypeUnits.PIXELS;

        return res;
    },

    _restorePSState: function(state) {
        app.preferences.rulerUnits = state.originalUnit;
        app.preferences.typeUnits = state.orgTypeUnit;
        app.backgroundColor = state.orgColor;
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
        
        if (dlg.useWestra.value && out2.length > 0)
        {
            dlg.logFile.write('[[$ReportPhotoHeader]]\n');
            dlg.logFile.write('<div class="zoom-gallery">\n\t');
            dlg.logFile.write(out2.join('\n\t'));
            dlg.logFile.write('\n</div><br/><br/>\n\n');
        }
        dlg.logFile.write(list.join('<br/>\n'));
        dlg.logFile.write("\n</body>\n</html>\n");
        dlg.logFile.close();
    },

    _initGUI: function() {
        var dlg = new Window(BridgeTalk.appName == "photoshop" ? 'dialog' : 'palette', 'Preview Builder v 0.4.3');
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
        var st = dlg.trow1.add('StaticText', undefined, {en: 'Descriptions:', ru: 'Описания:'});
        st.justify = "right";
        st.size = [92, 14];

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

        /*******************************************************/

        var rs = 'Group { align: "fill", alignChildren: "top",' +
                'col1: Group {orientation: "column", alignChildren: "left", align: "left"},' +
                'col2: Group {orientation: "column", alignChildren: "left", align: "right"}' +
            '}';
        var r =  dlg.add(rs);

        rs = 'Checkbox { align: "left", value:"true", text: "' + localize({en: 'Generate main', ru: 'Создать основные'}) + '"}';
        dlg.main = r.col1.add(rs);
        dlg.main.onClick = $cd(this, this._onMainChange);
        this.main = new CParamControl(r.col1, true);

        rs = 'Checkbox { align: "left", value:"false", text: "' + localize({en: 'Generate preview', ru: 'Создать превью'}) + '"}';
        dlg.preview = r.col2.add(rs);
        dlg.preview.onClick = $cd(this, this._onPreviewChange);
        this.preview = new CParamControl(r.col2, false);

        /*******************************************************/


        dlg.row7 = dlg.add('group'); //settPnl.
        dlg.log = dlg.row7.add('Button', undefined, {en: 'HTML log file...', ru: 'HTML лог-файл...'});
        dlg.logpath = dlg.row7.add('EditText', undefined, '', {readonly: true, borderless: true});
        dlg.logpath.characters = 50;
        dlg.log.onClick = $cd(this, this.chooseFile);
		
		dlg.useWestra = dlg.add('checkbox', undefined, {en: 'Add westra markup', ru: 'Разметка для Вестры'});
        dlg.useWestra.value = false;
        dlg.useWestra.enabled = false;
		

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

        this._canAddText();
        this._canStart();
        return dlg;
    },

     show: function() {
         this._initGUI();
         this.dlg.show();
     },

    _L: {	/*локализация*/
        build: {en: 'Build', ru: 'Запустить'},
        interrupt: {en: 'Break', ru: 'Прервать'},
    }
};

function CParamControl(root, full) {
	
	this._c = {
		root: root,
		panel: null,
		suffix: null,
		resize: null,
		dim: null,
		psd: null,
		qual: null,

		addText: null,
		font: null,
		textHeight: null
	};
	
	this._enabled = false;
	this._full = full || false;
    this._hasText = false;
	
	this._d_resize = $cd(this, this._onResize);
	this._d_psdChange = $cd(this, this._onPsdChange);
    this._d_canAddText = $cd(this, this._canAddText);

	this._buildIn(root);
}

CParamControl.prototype = {

    _L: {	/*локализация*/
        suffix: {en: 'Suffix:', ru: 'Суффикс:'},
        size: {en: 'Reference size:', ru: 'Размер:'}
    },
	
	_buildIn: function() {
		var c = this._c;
		
		c.panel = c.root.add('panel', undefined, '');
        c.panel.alignChildren = 'left';
		
		c.suffix = this._addSuffixControl(c.panel, this._full ? '_r' : '_prev');
		
		var r = c.panel.add('group');
        this._adjustStatic(r.add('StaticText', undefined, ''));
        c.resize = r.add('checkbox', undefined, {en: 'Resize', ru: 'Изменить размер'});
        c.resize.value = true;
        c.resize.onClick = this._d_resize;
		
		r = c.panel.add('group');
        this._adjustStatic(r.add('StaticText', undefined, {en: 'Reference size:', ru: 'Размер:'}));
        c.dim = r.add('EditText', undefined, this._full ? '1000' : '350');
        c.dim.characters = 6;
        c.dim.minvalue = 1;
        r.add('StaticText {text: "px"}');
		
		if (this._full) {
			r = c.panel.add('group');
			this._adjustStatic(r.add('StaticText', undefined, {en: 'Save as:', ru: 'Тип:'}));
			c.psd = r.add('dropdownlist', undefined, ['JPEG', 'PSD']);
			c.psd.selection = 0;
			c.psd.onChange = this._d_psdChange;
		}

		var cap = this._full ? {en: 'Quality:', ru: 'Качество:'} : {en: 'JPEG quality:', ru: 'Качество:'};
        c.qual = this._addQualControl(c.panel, cap, this._full ? '100' : '75');
		
		if (!this._full)
			return;
		
		r = c.panel.add('group');
        this._adjustStatic(r.add('StaticText', undefined, ''));
        c.addText = r.add('checkbox', undefined, {en: 'Add text', ru: 'Добавить подпись'});
        c.addText.value = true;
        c.addText.onClick = this._d_canAddText;

        r = c.panel.add('group');
        this._adjustStatic(r.add('StaticText', undefined, {en: 'Font size:', ru: 'Размер шрифта:'}));
        c.textHeight = r.add('EditText', undefined, '29');
        c.textHeight.characters = 6;

        r = c.panel.add('group');
        this._adjustStatic(r.add('StaticText', undefined, {en: 'Font name:', ru: 'Шрифт:'}));
        c.font = r.add('dropdownlist', undefined);

        var  selIndex = null;
        for (var i = 0; i < app.fonts.length; i++)
        {
            var name = app.fonts[i].name;
            if (selIndex == null && name == 'Calibri' || name == 'Century Gothic')
                selIndex = i;

            c.font.add('item', app.fonts[i].name);
        }
        c.font.selection = selIndex || 0;

        var t = this;
        c.textHeight.onChange = function() {c.font.enabled = t._limit(c.textHeight, 4, 0, 96) > 0; };
	},
	
	_onResize: function() {
		this._c.dim.enabled = this._enabled && this._c.resize.value;
	},

	setEnabled: function(value) {
		this._enabled = value;

		var c = this._c;
        c.resize.enabled = value;
        c.qual.enabled = value && !this.isPsd();
        c.suffix.enabled = value ;

        if (this._full)
            c.psd.enabled = value;
        this._onResize();
        this._canAddText();
	},
	
	enabled: function() {
		return this._enabled;
	},

    getParam: function() {		
		var c = this._c;
		
		var qual = this._limit(c.qual, this._full ? 100 : 75, 0, 100);
		if (this._full)
			qual = Math.round(qual * 12 / 100);
		
        var dim = c.resize.value ? this._limit(c.dim, this._full? 1000 : 350, 1, null): 0;
		var mode = this._full ? CParam.prototype.ResizeMode.minSide : CParam.prototype.ResizeMode.height;
		
		var param = new CParam(dim, qual, c.suffix.text || '', mode);
		
		if (this._full && c.font.selection != null) {
            param.font = app.fonts[c.font.selection.index]; //.getByName(c.font.selection.text);
            param.textHeight = c.addText.value ? this._limit(c.textHeight, 29, 0, 96) : 0;
        }
		
		return param;		
	},
	
	isPsd: function() {
		return this._c.psd && this._c.psd.selection.index == 1;
	},

    canAddText: function(val) {
       this._hasText = val || false;
       this._canAddText();
    },

	_canAddText: function() {
		if (!this._full)
			return;
		
        var c = this._c;
        var val = this._enabled && this._hasText;
        
		c.addText.enabled = val;
        val = val && c.addText.value;
        c.textHeight.enabled = val;
        c.font.enabled = val;
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

    _onPsdChange: function (e) {
        this._c.qual.enabled = this._enabled && !this.isPsd();
    }
}

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

    resize: function(doc, textFieldHeight/*, mode, offset*/)
    {
        if (!doc || this.dim == 0)
            return;
            
        textFieldHeight = textFieldHeight || 0;

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
        
        // пытаемся оставлять зазор для текста                                      // todo: разобраться, что делать, если меняется ширина
        if (newHeight != null)
            newHeight = Math.round(newHeight - textFieldHeight);

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
                this._processImage(doc, file, this._param, item, true, text.trim(), this._psd);
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
        var field = this._textFieldParams(param);     
        doc.resizeCanvas(null, Math.round(pos + field.height), AnchorPosition.TOPLEFT);
        doc.resizeImage(null, null, newDpi, ResampleMethod.NONE);

        var artLayerRef = doc.artLayers.add();
        artLayerRef.kind = LayerKind.TEXT;
        var textItemRef = artLayerRef.textItem;

        textItemRef.position = [0, Math.round(pos + field.pos)];

        var uv = new UnitValue(param.textHeight, 'px');
        uv.baseUnit = UnitValue(1 / newDpi, 'in');					// todo а почему 300 dpi?
        textItemRef.size = uv.as('pt');
        textItemRef.antiAliasMethod = AntiAlias.SHARP;
        textItemRef.ligatures = true;
        if (param.font)
            textItemRef.font = param.font.postScriptName;
        textItemRef.contents = text;
    },

    _textFieldParams: function(param) {
        if (!param || param.textHeight <=0)
            return {pos: 0, height: 0};
            
        return {
            pos: param.textHeight * 1.1,
            height: param.textHeight * 3 / 2
            };        
    },

    _processImage: function (doc, file, param, logItem, save, text, psd) {
        //var fname = file.fullName.slice(0, file.fullName.lastIndexOf('.'));
        var logname = file.fsName.slice(0, file.fsName.lastIndexOf('.'));

        var hasText = save && (text || '') != '' && param.textHeight > 0;
        var pos = this._textFieldParams(param);
        param.resize(doc, hasText ? pos.height : 0);

        
        if (hasText)
            this._addText(doc, param, text);

        var ext = psd && save ? '.psd' : '.jpg';
//		alert(fname + param.suffix + ext);
        var outFile = new File(logname + param.suffix + ext);

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
        this.alt = (alt || '').trim();

        var r = /^Фото [\d.]+\s*/gi;
        var res = r.exec(this.alt);

        this.altTitle =  res? (res[0] || res ) : '';
        this.altTitle = this.altTitle.trim();
        this.text = this.alt.substr(this.altTitle.length).trim();
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

        return '<table class="img" style="margin: auto;"><tbody>\n\t<tr><td>\n\t\t\t' + head + res + tail + alt + '\n\t</td></tr>\n</tbody></table>';
    },

    imageListItem: function(logPath, pathLen)
    {
        if (this.alt == '' || this.src == '')
            return null;

        return String.format('{0} <a href="{1}" target="_blank">{2}</a>', String.toHTML(this.altTitle), this._relativePath(this.src, logPath, pathLen), String.toHTML(this.text));
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

        return String.format('[[$ReportPhoto? &elemId=`f` &id=`{0}` &text=`{1}`]]', name, String.toHTML(this.alt));
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
