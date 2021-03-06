'use strict';
const hyperquest = require('hyperquest');

const apiBase = 'https://content.dropboxapi.com/2';
const api = {
  base: apiBase,
  download: apiBase + '/files/download',
  upload: apiBase + '/files/upload',
  uploadStart: apiBase + '/files/upload_session/start',
  uploadAppend: apiBase + '/files/upload_session/append_v2',
  uploadFinish: apiBase + '/files/upload_session/finish'
}

let safeJsonParse = function(data) {
  if (!data) {
    return;
  }

  try {
    let parsedData = JSON.parse(data);
    return parsedData;
  } catch (e) {
    return new Error(`Response parsing failed: ${e.message}`);
  }
}

let parseResponse = function(cb, isDownload) {
  return res => {
    const statusCode = res.statusCode;

    if (statusCode !== 200) {
      res.resume();
      return cb(new Error(`Request Failed.\nStatus Code: ${statusCode}`));
    }

    if (isDownload) {
      let rawData = res.headers['dropbox-api-result'];
      let parsedData = safeJsonParse(rawData);

      if (parsedData instanceof Error) {
        cb(parsedData);
      } else {
        cb(null, parsedData);
      }

      return;
    }

    const contentType = res.headers['content-type'];
    if (!isDownload && !/^application\/json/.test(contentType)) {
      res.resume();
      return cb(new Error(`Invalid content-type.\nExpected application/json but received ${contentType}`));
    }

    res.setEncoding('utf8');
    let rawData = '';
    res.on('data', (chunk) => {
      rawData += chunk
    });
    res.on('end', () => {
      let parsedData = safeJsonParse(rawData);

      if (parsedData instanceof Error) {
        cb(parsedData);
      } else {
        cb(null, parsedData);
      }
    });
  }
}

module.exports = function(opts, cb) {
  let headers = {
    'Authorization': 'Bearer ' + opts.token
  };

  if (opts.call !== 'download') {
    headers['Content-Type'] = 'application/octet-stream';
  }

  if (opts.args) {
    headers['Dropbox-API-Arg'] = JSON.stringify(opts.args);
  }

  let req = hyperquest(api[ opts.call ], {
    method: 'POST',
    headers: headers
  });

  req.on('error', cb);
  req.on('response', parseResponse(cb, opts.call === 'download'));
  req.end(opts.data);
  return req;
};
