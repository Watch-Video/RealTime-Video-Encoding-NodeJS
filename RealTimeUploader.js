var ProgressBar = require('progress');
var formidable = require('formidable');
var http = require('http');
var sys = require('sys');
var spawn = require('child_process').spawn;
var fs = require('fs');

function makeid() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < 5; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

function spawnFfmpeg(filename, exitCallback) {

    var new_args = ['-y', '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', '14000k', '-quality', 'best', '-slices', '8', '-threads', '0', '-mb_threshold', '0', '-profile:v', '3', '-nr', '0', '-crf', '19', '-qmin', '0', '-qmax', '63', '-c:a', 'libvorbis', '-ab', '192k', '-f', 'webm', '' + filename + ''];
    var args = ['-y', '-i', 'pipe:0', '-c:v', 'mjpeg', '-ss', '00:00:03', '-vframes', '1', 'thumbnail.jpg']
    var ffmpeg = spawn('ffmpeg', new_args);
    console.log('Spawning ffmpeg ' + new_args.join(' '));

    ffmpeg.on('exit', exitCallback);
    ffmpeg.stderr.on('data', function (data) {
        //console.log(data.toString());
        console.log(data.toString());
    });
    return ffmpeg;
}

http.createServer(function (req, res) {
    if (req.url == '/' && req.method.toLowerCase() == 'get') {
        // show a file upload form
        res.writeHead(200, {
            'content-type': 'text/html'
        });
        res.end('<form action="/upload" enctype="multipart/form-data" method="post">' + '<input type="text" name="title"><br>' + '<input type="file" name="upload" multiple="multiple"><br>' + '<input type="submit" value="Upload">' + '</form>');
    } else if (req.url == '/upload' && req.method.toLowerCase() == 'post') {
        // parse a file upload
        //req.setEncoding('binary');
        var size = 0;
        var chunks = 0;
        var msg = '';
        var data_available = false;
        var form = new formidable.IncomingForm();
        var ffmpeg = null;

        var len = parseInt(req.headers['content-length'], 10);
        var bar = new ProgressBar('  uploading [:bar] :percent :etas', {
            complete: '=',
            incomplete: ' ',
            width: 20,
            total: len
        });

        form.maxFieldsSize = 29 * 1024 * 1024;
        // Handle each part of the multi-part post
        var form = new formidable.IncomingForm();

        filename = 'realtime_' + makeid() + '.webm';

        // Handle each part of the multi-part post
        form.onPart = function (part) {
            ffmpeg = spawnFfmpeg(filename, function (code) {
                console.log('child process exited with code ' + code);
                res.writeHead(200, {
                    'content-type': 'text/html'
                });
                res.end('Success');
            });
            // Handle each data chunk as data streams in
            part.addListener('data', function (data) {
                bar.tick(data.length);
                data_available = true;
                chunks += data;
                //console.log('Received ' + (size += data.length) / (1024.0 * 1024.0) + ' Mb');
                /*
                 * This only one line was the solution of my problem now all works really fast !! 500mbit like transloadit it does
                 */

                if (chunks <= 1) {
                    msg = 'No valid data sended !';
                    console.log(msg);
                } else {
                    //msg = 'Success Received Chunks';
                    console.log(msg);
                    ffmpeg.stdin.write(data);
                }

            });
        };

        form.on('aborted', function () {
            console.log('Aborted');
            ffmpeg.kill();
            setTimeout(function () {
                fs.unlink(filename, function (err) {
                    if (err) {
                        throw err;
                    }
                    console.log('successfully deleted');
                });
            }, 1000);
        });

        req.on('end', function () {
            res.writeHead(200, {
                'content-type': 'text/html'
            });
            if (!data_available) {
                msg = 'No valid data sended !';
            }
            res.end(msg);
            console.log('\n');
        });
        // Do it
        form.parse(req);
    }
}).listen(80, "127.0.0.1");

process.on('uncaughtException', function (err) {
    console.error(err);
});