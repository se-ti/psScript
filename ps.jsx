/*
<javascriptresource>
<name>Generate report images</name>
<type>automate</type>
<about>Generating resource images. by se-ti</about>
<enableinfo>true</enableinfo>
</javascriptresource>
*/



#target photoshop

// $.level = 2;

/* todo
* filenames with spaces -- это формат файла
* высота больших?
*  -+ ввод путей руками
* output folder
* переделать layout на xml
* запоминать настройки с прошлого запуска?
* font -- выбирать Calibri по умолчанию
* автоматически подтягивать единственный txt файл в папке
*
* +- font setup,
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

	chooseFile: function ()
	{
		var title = 'Choose file to save log';
		var filter = ['HTML files:*.html;*.htm,All files:*.*'];

		var dlg = this.dlg;
		if (dlg.logFile)
			dlg.logFile = dlg.logFile.openDlg(title, filter);
		else
			dlg.logFile = File.openDialog(title, filter);

		this._setPathText(dlg.logpath, dlg.logFile);
	},

	chooseFolder: function() {
		var title = "Choose folder to convert";

		this.srcFolder =  this._lastPath ? Folder(this._lastPath).selectDlg(title) : Folder.selectDialog(title);
		this.dlg.recursive.enabled = this.srcFolder instanceof Folder;
		this._canStart();

		this._setPathText(this.dlg.path, this.srcFolder);

		this._lastPath = this.srcFolder ? (this.srcFolder instanceof Folder ? this.srcFolder.fullName : this.srcFolder.path) : null;
	},

	_canStart: function() {
		this.dlg.btnPnl.buildBtn.enabled = this.srcFolder != null && (this.dlg.main.value || this.dlg.preview.value);
	},

	mainChange: function(e) {
		var dlg = this.dlg;
		var val = dlg.main.value;

		dlg.refDim.enabled = val;
		dlg.qual.enabled = val && dlg.psd.selection.index != 1;
		dlg.suffix.enabled = val;
		dlg.psd.enabled = val;
		dlg.font.enabled = val;
		dlg.textHeight.enabled = val;

		this._canStart();
	},

	previewChange: function (e) {
		var dlg = this.dlg;
		var val = dlg.preview.value;

		dlg.prevRefDim.enabled = val;
		dlg.prevQual.enabled = val;
		dlg.prevSuffix.enabled = val;

		this._canStart();
	},

	psdChange: function (e) {
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
		var dlg = this.dlg;
		app.breakProcess = false;

		var qual = this._limit(dlg.qual, 100, 0, 100);
		var dim = this._limit(dlg.refDim, 1000, 0, null);
		var param = dlg.main.value ? new CParam(dim, Math.round(qual * 12 / 100), dlg.suffix.text || '', CParam.prototype.ResizeMode.minSide) : null;

		qual = this._limit(dlg.prevQual, 75, 0, 100);
		dim = this._limit(dlg.prevRefDim, 200, 0, null);
		var prevParam = dlg.preview.value ? new CParam(dim, qual, dlg.prevSuffix.text || '', CParam.prototype.ResizeMode.refSize) : null;

		if (dlg.font.selection != null) {
			param.font = app.fonts[dlg.font.selection.index]; //.getByName(dlg.font.selection.text);
			param.textHeight = this._limit(dlg.textHeight, 18, 0, 96);
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

		this.processFolder(this.srcFolder, dlg.recursive.value, param, prevParam, logArr, dlg.psd.selection.index == 1, dlg.desc.text);

		if (dlg.logFile)
			this.writeLog(dlg.logFile, logArr);

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

					file = /^\S*/gi.exec(ln);
					res.push(new CFile(File(folder.fullName + '/' + file), ln.replace(/^\S*\s+/i, '')));
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
			st.size = [86, 14];
			st.justify = 'right';
		}
	},

	_setPathText: function (ctrl, file) {
		ctrl.text = file ? file.fsName : '';
		ctrl.bounds.bottom = ctrl.bounds.top + 19;
	},

	_initGUI: function() {
		var dlg = new Window(BridgeTalk.appName == "photoshop" ? 'dialog' : 'palette', 'Preview Builder v 0.2.1');
		this.dlg = dlg;

		dlg.alignChildren = 'fill';


		dlg.ctrlPnl = dlg.add('panel', undefined, 'Source folder');

		dlg.ctrlPnl.alignChildren = 'left';
		dlg.srcGrp = dlg.ctrlPnl.add('group');
        dlg.browseBtn = dlg.srcGrp.add('button', undefined, 'Choose...');

		dlg.path = dlg.srcGrp.add('editText', undefined, ''); //, {readonly: false, borderless: true});	// , {readonly: false, borderless: true}
		dlg.path.characters = 40;

		var t = this;
		dlg.path.onChange = function(e) {
			var path = dlg.path.text || '';
			var f = Folder(path);
            dlg.recursive.enabled = f.exists;
            t.srcFolder = f.exists ? f : null;
			if (f.exists)
                t._lastPath = dlg.srcFolder.fullName;
			else if (path != '')
				alert('Path "' + path + '" doesn\'t exist!');

			t._canStart();
		};

		dlg.browseBtn.onClick = $cd(this, this.chooseFolder);

		dlg.recursive = dlg.ctrlPnl.add('checkbox', undefined, 'Include all subfolders');
		dlg.recursive.value = false;

		dlg.trow1 = dlg.ctrlPnl.add('group');
		this._adjustStatic(dlg.trow1.add('StaticText', undefined, 'Descriptions:'));
		dlg.desc = dlg.trow1.add('EditText', undefined, 'photo.txt');
		dlg.desc.characters = 15;

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
		dlg.main = dlg.col1.add('checkbox', undefined, 'Generate main');
		dlg.main.align = 'left';
		dlg.main.value = true;
		dlg.main.onClick = $cd(this, this.mainChange);

		dlg.TransformPnl = dlg.col1.add('panel', undefined, '');
		dlg.TransformPnl.alignChildren = 'left';
		//dlg.TransformPnl.orientation = 'row';

		dlg.row0 = dlg.TransformPnl.add('group');
		this._adjustStatic(dlg.row0.add('StaticText', undefined, 'Reference size:'));
		dlg.refDim = dlg.row0.add('EditText', undefined, '1000');
		dlg.refDim.characters = 6;
		dlg.refDim.minvalue = 1;

		dlg.row1 = dlg.TransformPnl.add('group');
		this._adjustStatic(dlg.row1.add('StaticText', undefined, 'Quality:'));
		dlg.qual = dlg.row1.add('EditText', undefined, '100');
		dlg.qual.characters = 6;
		dlg.qual.minvalue = 1;
		dlg.qual.maxvalue = 100;

		dlg.row2 = dlg.TransformPnl.add('group');
		this._adjustStatic(dlg.row2.add('StaticText', undefined, 'Suffix:'));
		dlg.suffix = dlg.row2.add('EditText', undefined, '_r');
		dlg.suffix.characters = 6;

		dlg.row3 = dlg.TransformPnl.add('group');
		this._adjustStatic(dlg.row3.add('StaticText', undefined, 'Save as:'));
		dlg.psd = dlg.row3.add('dropdownlist', undefined, ['JPEG', 'PSD']);
		dlg.psd.selection = 0;
		dlg.psd.onChange = $cd(this, this.psdChange);

		dlg.row4_ = dlg.TransformPnl.add('group');
		this._adjustStatic(dlg.row4_.add('StaticText', undefined, 'Font size:'));
		dlg.textHeight = dlg.row4_.add('EditText', undefined, '18');
		dlg.textHeight.characters = 6;

		dlg.row5_ = dlg.TransformPnl.add('group');
		this._adjustStatic(dlg.row5_.add('StaticText', undefined, 'Font name:'));
		dlg.font = dlg.row5_.add('dropdownlist', undefined);
		for (var i = 0; i < app.fonts.length; i++)
			dlg.font.add('item', app.fonts[i].name);

        dlg.font.selection = 1;

		//var t = this;
        dlg.textHeight.onChange = function() {t.dlg.font.enabled = t._limit(t.dlg.textHeight, 4, 0, 96) > 0; };

		/*******************************************************/

		dlg.preview = dlg.col2.add('checkbox', undefined, 'Generate preview');
		dlg.preview.value = false;
		dlg.preview.onClick = $cd(this, this.previewChange);

		dlg.settPnl = dlg.col2.add('panel', undefined, '');
		dlg.settPnl.alignChildren = 'left';

		dlg.row4 = dlg.settPnl.add('group');
		this._adjustStatic(dlg.row4.add('StaticText', undefined, 'Reference size:'));
		dlg.prevRefDim = dlg.row4.add('EditText', undefined, '200');
		dlg.prevRefDim.characters = 6;
		dlg.prevRefDim.minvalue = 1;

		dlg.row5 = dlg.settPnl.add('group');
		this._adjustStatic(dlg.row5.add('StaticText', undefined, 'JPEG quality:'));
		dlg.prevQual = dlg.row5.add('EditText', undefined, '75');
		dlg.prevQual.characters = 6;
		dlg.prevQual.minvalue = 1;
		dlg.prevQual.maxvalue = 100;

		dlg.row6 = dlg.settPnl.add('group');
		this._adjustStatic(dlg.row6.add('StaticText', undefined, 'Suffix:'));
		dlg.prevSuffix = dlg.row6.add('EditText', undefined, '_prev');
		dlg.prevSuffix.characters = 6;

		/*******************************************************/


		dlg.row7 = dlg.add('group'); //settPnl.
		dlg.log = dlg.row7.add('Button', undefined, 'HTML log file...');
		dlg.logpath = dlg.row7.add('EditText', undefined, '', {readonly: true, borderless: true});
		dlg.logpath.characters = 50;
		dlg.log.onClick = $cd(this, this.chooseFile);

		dlg.btnPnl = dlg.add('group');
		dlg.btnPnl.alignment = 'center';
		dlg.btnPnl.buildBtn = dlg.btnPnl.add('button', undefined, 'Build', {name: 'ok'});
		dlg.btnPnl.buildBtn.enabled = false;
		dlg.btnPnl.cancelBtn = dlg.btnPnl.add('button', undefined, 'Cancel', {name: 'cancel'});

		dlg.btnPnl.buildBtn.onClick = $cd(this, this.start);
		dlg.btnPnl.cancelBtn.onClick = function () {
			app.breakProcess = true;
			dlg.close();
		};

		this.mainChange();
		this.previewChange();
		return dlg;
	},

	 show: function() {
		 this._initGUI();
		 this.dlg.show();
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
