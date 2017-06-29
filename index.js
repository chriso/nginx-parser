var fs = require('fs')
  , spawn = require('child_process').spawn;

/**
 * Create a log parser.
 *
 * @param {String} format
 */

var Parser = module.exports = function (format) {
    this.directives = {};

    var prefix = format.match(/^[^\$]*/);
    if (prefix) {
        format = this.escape(prefix[0]) + format.slice(prefix[0].length);
    }

    this.parser = format;

    var directive = /\$([a-z_]+)(.)?([^\$]+)?/g
      , match, regex, boundary, i = 1;

    while ((match = directive.exec(format))) {
        this.directives[match[1]] = i++;
        if (match[2]) {
            boundary = this.escape(match[2]);
            regex = '([^' + boundary + ']*?)' + boundary;
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
 * @param {Function} iterator - called for each line
 * @param {Function} callback (optional) - called at the end
 */

Parser.prototype.read = function (path, options, iterator, callback) {
    if (typeof options === 'function') {
        callback = iterator;
        iterator = options;
    }
    if (!path || path === '-') {
        return this.stdin(iterator, callback);
    } else if (options.tail) {
        return this.tail(path, iterator, callback);
    }
    return this.stream(fs.createReadStream(path), iterator, callback);
};

/**
 * Parse a log file and watch it for changes.
 *
 * @param {String} path
 * @param {Function} iterator - called for each line
 * @param {Function} callback (optional) - called at the end
 */

Parser.prototype.tail = function (path, iterator, callback) {
    var stream = spawn('tail', [ '-F', '-c', '+0', path]).stdout;
    return this.stream(stream, iterator, callback);
};

/**
 * Parse a log stream from STDIN.
 *
 * @param {Function} iterator - called for each line
 * @param {Function} callback (optional) - called at the end
 */

Parser.prototype.stdin = function (iterator, callback) {
    return this.stream(process.stdin, iterator, callback);
};

/**
 * Parse a log stream.
 *
 * @param {ReadableStream} stream
 * @param {Function} iterator - called for each line
 * @param {Function} callback (optional) - called at the end
 */

Parser.prototype.stream = function (stream, iterator, callback) {
    var self = this, overflow = new Buffer(0), complete = false;
    stream.on('data', function (data) {
        var buffer = Buffer.concat([overflow, data]), newline = 0;
        for (var i = 0, len = buffer.length; i < len; i++) {
            if (buffer[i] === 10) {
                self.parseLine(buffer.slice(newline, i), iterator);
                newline = i + 1;
            }
        }
        overflow = buffer.slice(newline);
    });
    if (callback) {
        stream.on('error', function (err) {
            if (complete) return;
            complete = true;
            callback(err);
        });
    }
    stream.on('end', function () {
        if (overflow.length) {
            self.parseLine(overflow, iterator);
        }
        if (complete) return;
        complete = true;
        if (callback) {
            callback();
        }
    });
    if (stream.resume) {
        process.nextTick(function () {
            stream.resume();
        });
    }
    return stream;
};

/**
 * Parse a log line.
 *
 * @param {Buffer|String} line
 * @param {Function} iterator
 */

Parser.prototype.parseLine = function (line, iterator) {
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

    iterator(row);
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
