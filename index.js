var fs = require('fs')
  , spawn = require('child_process').spawn;

/**
 * Create a log parser.
 *
 * @param {String} format
 */

var Parser = module.exports = function (format) {
    this.parser = format;
    this.directives = {};

    var directive = /\$([a-z_]+)(.)?([^\$]+)?/g
      , match, regex, boundary, i = 1;

    while ((match = directive.exec(format))) {
        this.directives[match[1]] = i++;
        if (match[2]) {
            boundary = this.escape(match[2]);
            regex = '([^' + boundary + ']+)' + boundary;
            if (match[3]) {
                regex += this.escape(match[3]);
            }
        } else {
            regex = '(.+)$';
        }
        this.parser = this.parser.replace(match[0], regex);
    }

    this.parser = new RegExp(this.parser);
};

/**
 * Parse a log file.
 *
 * @param {String} path
 * @param {Object} options (optional)
 * @param {Function} callback
 */

Parser.prototype.read = function (path, options, callback) {
    if (!path || path === '-') {
        return this.stdin(callback);
    } else if (options.tail) {
        return this.tail(path, callback);
    }
    return this.stream(fs.createReadStream(path), callback);
};

/**
 * Parse a log file and watch it for changes.
 *
 * @param {String} path
 * @param {Function} callback
 */

Parser.prototype.tail = function (path, callback) {
    var stream = spawn('tail', [ '-F', '-c', '+0', path]).stdout;
    return this.stream(stream, callback);
};

/**
 * Parse a log stream from STDIN.
 *
 * @param {Function} callback
 */

Parser.prototype.stdin = function (callback) {
    return this.stream(process.stdin, callback);
};

/**
 * Parse a log stream.
 *
 * @param {ReadableStream} stream
 * @param {Function} callback
 */

Parser.prototype.stream = function (stream, callback) {
    var self = this, overflow = new Buffer(0);
    stream.on('data', function (data) {
        var buffer = overflow.concat(data), newline = 0;
        for (var i = 0, len = buffer.length; i < len; i++) {
            if (buffer[i] === 10) {
                self.parseLine(buffer.slice(newline, i), callback, stream);
                newline = i + 1;
            }
        }
        overflow = buffer.slice(newline);
    });
    stream.on('end', function () {
        if (overflow.length) {
            self.parseLine(overflow, callback, stream);
        }
    });
    process.nextTick(function () {
        stream.resume();
    });
    return stream;
};

/**
 * Parse a log line.
 *
 * @param {Buffer|String} line
 * @param {Function} callback
 */

Parser.prototype.parseLine = function (line, callback) {
    var match = line.toString().match(this.parser);
    if (!match) {
        return;
    }

    var row = {
        msec: null
      , time_iso8601: null
      , remote_addr: null
      , query_string: null
      , http_x_forwarded_for: null
      , http_user_agent: null
      , http_referer: null
      , time_local: null
      , request: null
      , status: null
      , request_time: null
      , request_length: null
      , pipe: null
      , connection: null
      , bytes_sent: null
      , body_bytes_sent: null

      , date: null
      , timestamp: null
      , ip: null
      , ip_str: null
    };

    for (var key in this.directives) {
        row[key] = match[this.directives[key]];
        if (row[key] === '-') {
            row[key] = null;
        }
    }

    //Parse the timestamp
    if (row.time_iso8601) {
        row.date = new Date(row.time_iso8601);
    } else if (row.msec) {
        row.date = new Date(Number(row.msec.replace('.', '')));
    }
    if (row.date) {
        row.timestamp = row.date.getTime();
    }

    //Parse the user's IP
    if (row.http_x_forwarded_for) {
        row.ip_str = row.http_x_forwarded_for;
    } else if (row.remote_addr) {
        row.ip_str = row.remote_addr;
    }
    if (row.ip_str) {
        var ip = row.ip_str.split('.', 4);
        row.ip = Number(ip[0]) * (2 << 23) +
            Number(ip[1]) * (2 << 15) +
            Number(ip[2]) * (2 << 7) +
            Number(ip[3]);
    }

    callback(row);
};

/**
 * Escape regular expression tokens.
 *
 * @param {String} str
 * @return {String}
 */

Parser.prototype.escape = function (str) {
    return str.replace(new RegExp('[.*+?|()\\[\\]{}]', 'g'), '\\$&');
};
