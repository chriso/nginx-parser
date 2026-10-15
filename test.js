var assert = require('assert')
  , Parser = require('./');

var tests = [
    {
        name: 'parses time_iso8601 as the final directive',
        format: '$time_iso8601',
        line: '2017-10-18T18:19:52+00:00',
        expected: {
            time_iso8601: '2017-10-18T18:19:52+00:00',
            timestamp: 1508350792000
        },
        date: '2017-10-18T18:19:52.000Z'
    },
    {
        name: 'parses time_iso8601 inside brackets',
        format: '[$time_iso8601] $status',
        line: '[2017-10-18T18:19:52+00:00] 200',
        expected: {
            time_iso8601: '2017-10-18T18:19:52+00:00',
            status: '200',
            timestamp: 1508350792000
        },
        date: '2017-10-18T18:19:52.000Z'
    },
    {
        name: 'parses a complete access log with time_iso8601',
        format: '$remote_addr - $remote_user [$time_iso8601] '
            + '"$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"',
        line: '127.0.0.1 - - [2017-10-18T20:19:52+02:00] '
            + '"GET /index.html HTTP/1.1" 200 123 "-" "Example Browser/1.0"',
        expected: {
            remote_addr: '127.0.0.1',
            remote_user: null,
            time_iso8601: '2017-10-18T20:19:52+02:00',
            request: 'GET /index.html HTTP/1.1',
            status: '200',
            body_bytes_sent: '123',
            http_referer: null,
            http_user_agent: 'Example Browser/1.0',
            ip_str: '127.0.0.1',
            ip: 2130706433,
            timestamp: 1508350792000
        },
        date: '2017-10-18T18:19:52.000Z'
    },
    {
        name: 'parses other directives containing digits',
        format: '$http_x_b3_traceid $arg_v2',
        line: '463ac35c9f6413ad48485a3953bb6124 value',
        expected: {
            http_x_b3_traceid: '463ac35c9f6413ad48485a3953bb6124',
            arg_v2: 'value'
        }
    },
    {
        name: 'preserves the existing combined log format',
        format: '$remote_addr - $remote_user [$time_local] '
            + '"$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"',
        line: '127.0.0.1 - - [18/Oct/2017:18:19:52 +0000] '
            + '"GET / HTTP/1.1" 200 123 "-" "Example Browser/1.0"',
        expected: {
            remote_addr: '127.0.0.1',
            remote_user: null,
            time_local: '18/Oct/2017:18:19:52 +0000',
            request: 'GET / HTTP/1.1',
            status: '200',
            body_bytes_sent: '123',
            http_referer: null,
            http_user_agent: 'Example Browser/1.0',
            ip_str: '127.0.0.1',
            ip: 2130706433,
            date: null,
            timestamp: null
        }
    },
    {
        name: 'preserves msec timestamp parsing',
        format: '$msec $status',
        line: '1508350792.000 204',
        expected: {msec: '1508350792.000', status: '204', timestamp: 1508350792000},
        date: '2017-10-18T18:19:52.000Z'
    }
];

var failures = 0;
tests.forEach(function (test) {
    try {
        var rows = [];
        new Parser(test.format).parseLine(test.line, function (row) {
            rows.push(row);
        });
        assert.strictEqual(rows.length, 1, 'expected one parsed row');
        Object.keys(test.expected).forEach(function (key) {
            assert.strictEqual(rows[0][key], test.expected[key], key);
        });
        if (test.date) {
            assert.strictEqual(rows[0].date.toISOString(), test.date, 'date');
        }
        console.log('ok - ' + test.name);
    } catch (error) {
        failures++;
        console.error('not ok - ' + test.name);
        console.error(error.stack);
    }
});

console.log((tests.length - failures) + '/' + tests.length + ' tests passed');
process.exit(failures ? 1 : 0);
