var babel = require("babel-core");
var path  = require("path");
var url   = require("url");
var fs    = require("fs");
var _     = require("lodash");

module.exports = function (opts) {
  opts = _.defaults(opts || {}, {
    options: {},
    dest:    "cache",
    src:     "assets"
  });

  var cache = Object.create(null);

  return function (req, res, next) {
    if (!babel.canCompile(req.url)) return next();

    var pathname = path.normalize(url.parse(req.url).pathname);
    var dest = path.join(opts.dest, pathname);
    var src  = path.join(opts.src, pathname);
    var srcStat;

    var send = function (data) {
      res.setHeader('Content-Type', 'application/javascript');
      res.end(data);
    };

    var write = function (transformed) {
      fs.writeFile(dest, transformed, function (err) {
        if (err) {
          next(err);
        } else {
          cache[pathname] = +srcStat.mtime;
          send(transformed);
        }
      });
    };

    var compile = function () {
      var transformOpts = _.clone(opts.options);
      babel.transformFile(src, transformOpts, function (err, result) {
        if (err) {
          next(err);
        } else {
          write(result.code);
        }
      });
    };

    var tryCache = function () {
      fs.readFile(dest, function (err, data) {
        if (err && err.code === 'ENOENT') {
          compile();
        } else if (err) {
          next(err);
        } else {
          send(data);
        }
      });
    };

    fs.stat(src, function (err, stat) {
      srcStat = stat;
      if (err && err.code === 'ENOENT') {
        next();
      } else if (err) {
        next(err);
      } else if (cache[pathname] === +stat.mtime) {
        tryCache();
      } else {
        compile();
      }
    });
  };
};
