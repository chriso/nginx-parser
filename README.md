**nginx_parser** parse nginx log files in node.js

### Installation

```bash
$ npm install nginxparser
```

### Usage

To read a log file

```javascript
var NginxParser = require('nginx_parser');

var parser = new NginxParser('$remote_addr - $remote_user [$time_local] '
		+ '"$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"');

parser.read(path, function (row) {
    console.log(row);
});
```

To read from stdin, pass `-` as the path.

To tail a log file (equivalent to `tail -F`)

```javascript
parser.read(path, { tail: true }, function (row) {
    //...
});
```


To use a callback after reading

```javascript
parser.read(path, { onEnd: function(parser){
    //...
} }, function (row) {
    //...
});
```
