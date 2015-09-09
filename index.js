
var hbjs = require("handbrake-js"),
	ProgressBar = require('progress'),
	Path = require('path');
 /*
hbjs.exec({ "preset-list": true }, function(err, stdout, stderr){
    if (err) throw err;
    console.log(stdout);
});
*/
/*
process.argv.forEach(function (val, index, array) {
  console.log(index + ': ' + val);
});
*/

function getArgumentKeyValue(key, defaultValue){
	if(process.argv.indexOf(key) != -1){ //does our flag exist?
	    return process.argv[process.argv.indexOf(key) + 1]; //grab the next item
	}
	return defaultValue;

}
var options = {};
options.input = getArgumentKeyValue('-i', null);
options.output = getArgumentKeyValue('-o', null);
options.title = getArgumentKeyValue('-t', null);
options.season = getArgumentKeyValue('-s', null);
options.episodes = getArgumentKeyValue('-e', null);
options.episodeTitles = getArgumentKeyValue('-et', null);
//options.chapters = getArgumentKeyValue('-c', 0);
options.minLength = getArgumentKeyValue('-min', 40);
options.maxLength = getArgumentKeyValue('-max', 50);
options.handbrakeArgs = getArgumentKeyValue('-handbrake', '');
options.debug = (getArgumentKeyValue('-debug', false) == 'true');



if (!options.input){ console.log('Input not valid!'); return; }
if (!options.output){ console.log('Output not valid!'); return; }
if (!options.season){ console.log('Season not valid!'); return; }


if (options.episodes != null) { options.episodes = options.episodes.split(','); }
if (options.episodeTitles != null) { options.episodeTitles = options.episodeTitles.split(','); }
if (!options.title) { options.title = options.input.split('/').pop(); }


console.log('running with options:', options);

var chapterLength = 0;


scan();





function scan(){
	hbjs.exec({i: options.input, scan:true, t:0, 'min-duration': (options.minLength * 60)}, function(err, stdout, stderr){
	    if (err) throw err;
	    //console.log('stdout', stdout);
	    //console.log('stderr', stderr);

	    var lines = stderr.toString().split('\n');

	    var titles = [];
	    var curTitle = -1;
	    var inChapter = false;

	    for (var i=0; i<lines.length; i++){
	    	var line = lines[i];
	    	var parts = line.trim().split(' ');

	    	if (line.indexOf('+') == 0){
	    		if (line.indexOf('+ title') == 0){
	    			inChapter = false;
	    			curTitle++;
	    			//titles.push({title: line.substring(8,9)});
	    			//titles[curTitle] = {title: line.substring(8,9)};
	    			titles[curTitle] = {title: line.split(' ')[2].replace(':','')};

	    		}
	    		//console.log(line);
	    	}

	    	if (line.indexOf('  + duration:') == 0){
	    		var duration = line.split(': ')[1];
	    		titles[curTitle].duration = duration;
	    		titles[curTitle].minutes = durationToMinutes(duration);

	    	}

	    	if (line.indexOf('  + chapters:') == 0){
	    		inChapter = true;

	    	}

	    	if (inChapter && line.indexOf('    + ') == 0){
	    		var chapterMin = durationToMinutes(parts[7]);
	    		var chapterSec = durationToSeconds(parts[7]);
	    		//var chapterNumber = line.replace('    + ', '').split(':')[0];
	    		var chapterNumber = parseInt(parts[1].replace(':', ''));

	    		console.log('Title %s-%s: %s min, %s sec', titles[curTitle].title, chapterNumber, chapterMin, chapterSec);
	    		if (chapterSec > 10){
	    			titles[curTitle].chapters = chapterNumber;
	    		}
	    	}

	    	if (line.indexOf('  + audio ') == 0){
	    		inChapter = false;

	    	}
	    }

	    console.log('titles', titles);
	    //return;


	    for (var i = 0; i < titles.length; i++) {
	    	var title = titles[i];
	    	if (chapterLength == 0 && title.minutes >= options.minLength && title.minutes <= options.maxLength){
	    		chapterLength = parseInt(title.chapters);
	    	}
	    };

	    //console.log(chapterLength);

	    var convert = [];

	    if (options.episodes != null && options.episodeTitles != null){
	    	for (var i = 0; i < options.episodeTitles.length; i++) {
	    		var titleNumber = options.episodeTitles[i];
	    		for (var x = 0; x < titles.length; x++) {
	    			var title = titles[x];
	    			if (titleNumber == title.title){ convert.push(title); }
	    		};
	    	};

	    	if (convert.length != options.episodes.length){
	    		console.log('Not enough episodes found', convert);
	    		return;
	    	}


	    	console.log('convert:', convert);
	    	convertTitles(convert);
	    	return;
	    }

	    /* try to split the main title */
	    if (options.episodes != null){
	    	var mainTitle = null;	    	
	    	for (var i = 0; i < titles.length; i++) {
	    		var title = titles[i];
	    		if (title.minutes > options.maxLength){
	    			mainTitle = title;
	    		}
	    	};

	    	if (mainTitle != null){
	    		for (var i = 0; i < options.episodes.length; i++) {
	    			var e = options.episodes[i];
	    			var cMin = (i * chapterLength) + 1;
	    			var cMax = (cMin + chapterLength) - 1;
	    			convert.push({title: mainTitle.title, chapters: cMin +'-'+ cMax })
	    		};

	    		console.log('convert', convert);
	    		if (!options.debug){
	    			convertTitles(convert);
	    		}
	    		return;
	    	}

	    }



	    /* Try to find episodes automaigically */
	    if (options.episodes != null) {
	    	var episodes = options.episodes;
	    	//console.log('episodes.length', episodes.length);
	    	/* find the first n episodes that match the time or chapters */
	    	for (var i = 0; i < titles.length; i++) {
	    		var title = titles[i];
	    		var exists = durationExists(convert, title.duration);
	    		if (convert.length < episodes.length && !exists){
	    			if ((title.minutes >= options.minLength && title.minutes <= options.maxLength) || title.chapters == chapterLength){
	    				convert.push(title);
	    			}
	    		}

	    	};

	    	if (convert.length != episodes.length){
	    		console.log('Not enough episodes found', convert);
	    		return;
	    	}


	    	console.log('convert:', convert);
	    	if (!options.debug){
    			convertTitles(convert);
    		}
	    	return;
	    }
	});

}

function durationExists(items, duration){
	for (var i = 0; i < items.length; i++) {
		if (items[i].duration == duration){ return true; }
	}
	return false;
}


function convertTitles(titles){
	/*
	for (var i = 0; i < titles.length; i++) {
		var title = titles[i];
		var episodeName = options.title +' S'+ pad(options.season, 2) +'E'+ pad(options.episodes[i],2);
		console.log('convert: ', title.title, ' > ', episodeName);


	};
	*/
	if (titles.length <= 0) { 
		//console.log('titles.length: ', titles.length);
		console.log('Finished converting titles.')
		return; 
	}

	var title = titles.shift();
	var episode = options.episodes.shift();
	var episodeName = options.title +' - S'+ pad(options.season, 2) +'E'+ pad(episode,2) +'.mp4';
	var handbrakeOptions = { input: options.input, title: parseInt(title.title), output: Path.join(options.output, episodeName) };
	//console.log('convert: ', title.title, ' > ', episodeName, handbrakeOptions);
	var display = 'Converting Title '+ title.title;
	if (title.chapters.indexOf('-')){
		handbrakeOptions.chapters = title.chapters;
		display += ' Chapters '+ title.chapters;
	}

	var bar = new ProgressBar(display +' > '+ episodeName +' ... [:bar] :percent  ETA :timeLeft FPS::fps', {
    	complete: '=',
    	incomplete: ' ',
    	width: 25,
    	total: 100
    });

	hbjs.spawn(handbrakeOptions)
	.on("error", function(err){
	    // invalid user input, no video found etc 
	})
	.on('begin', function(){
		//console.log('Start converting: ', title.title, ' > ', episodeName);
	})
	.on("progress", function(progress){
	    //console.log(
	    //  "Percent complete: %s, ETA: %s", 
	    //  progress.percentComplete, 
	    //  progress.eta
	    //);
		if (progress.percentComplete < 100){
			bar.update((progress.percentComplete/100), {timeLeft: progress.eta, fps: progress.fps});
			//console.log(parseInt(progress.percentComplete), progress.percentComplete, progress.eta);
		}
	})
	.on("end", function(err){
	    //console.log('Finished converting: ', title.title, ' > ', episodeName);
	    bar.update(100, {timeLeft: 0, fps: 0});
	})
	.on("complete", function(err){
		convertTitles(titles);
	});

}

function pad(num, size) {
    var s = "000000000" + num;
    return s.substr(s.length-size);
}

function durationToMinutes(duration){
	var parts = duration.split(':');
	if (parts.length == 3 || parts.length == 2) {
		return (parseInt(parts[0])*60) + parseInt(parts[1]);
	}
	return parseInt(duration)
}

function durationToSeconds(duration){
	var parts = duration.split(':');
	if (parts.length == 3 || parts.length == 2) {
		return (parseInt(parts[0])*60*60) + parseInt(parts[1])*60 + parseInt(parts[2]);
	}
	return parseInt(duration)
}
