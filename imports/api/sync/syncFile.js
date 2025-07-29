/* eslint-disable */
import { Meteor } from 'meteor/meteor';
import { HTTP } from 'meteor/http';
import { EJSON } from 'meteor/ejson';
import { _Units } from '../units/units';
import { _Topics, _Resources } from '../topics/topics';
// import { _Resources } from '../topics/topics';
// import { _SearchData } from '../search/search';
import { _Statistics } from '../statistics/statistics';
import { _Deleted } from '../Deleted/deleted';
import { _Settings } from '../settings/settings';

// _Units,_Topics,_Resources,_SearchData, _Statistics ,_Deleted,_Egranary,_Settings

// eslint-disable-next-line
Meteor.startup(function() {
  fs = Npm.require('fs'); //file system(fs)
  http = require('http');
  util = require('util');
  
  Fiber = require('fibers');
  exec = require('child_process').exec;
  // sys = require('sys');
  // sudoCommand = require('sudo-prompt');

  var bodyParser = Npm.require('body-parser');
  Picker.middleware(bodyParser.urlencoded({ extended: false }));
  Picker.middleware(bodyParser.json());

  var postRoutes = Picker.filter(function(req, res) {
    // you can write any logic you want.
    // but this callback does not run inside a fiber
    // at the end, you must return either true or false
    return req.method==='POST';
  });
});

var resourceSize = 0;
var resourceIndex = 0;
var resources = [];
var failedResources = [];
var downloadedResources = [];
var resourceName = '';
var chunkSize = 0;
var chunkSizeDiff = 0;
var isSyncRuning = false;
var skippedResource = false;
var resourcePath = null;
var school = null;

const files = { unit: 'syncUnit.js', topic: 'syncTopic.js', resource: 'syncResource.js' };
// removed egranary collection temporary
const mCollections = { unit: _Units, topic: _Topics, resource: _Resources, delete: _Deleted };

var hostUrl = null; //'http://192.168.8.150:3000/';
var downloadPath = null; //'http://192.168.8.150:3000/';
// const hostUrl = 'http://52.42.16.134/';
//const hostUrl = 'localhost:3000/';

const syncPath = process.env.PWD + '/public/syncFile/';
const uploadPath = process.env.PWD + '/public/uploads/';
const updatePath = process.env.PWD + '/public/updates/';
const publicPath = process.env.PWD + '/public/';
//const school = null;//config
//Cloud
//const uploadPath = 'www/manoap/bundle/programs/web.browser/app/private/';

//write to section
Meteor.methods({
  deleteFile: function(file) {
    check(file, String);

    var path = uploadPath + file;
    var fileStatus = Meteor.call('resourceExists', path);

    if (fileStatus) {
      fs.unlinkSync(path);
    }
  },
});

//get sync Address
Meteor.methods({
  getServerUrl: function() {
    var setting = _Settings.findOne({ label: 'syncAddress' });
    return (hostUrl = setting.val);
  },
});
//get one  setting value
Meteor.methods({
  getSetting: function(label) {
    var setting = _Settings.findOne({ label: label });
    return (hostUrl = setting.val);
  },
});

//get all settings
Meteor.methods({
  getSettings: function() {
    var settings = _Settings.findOne({});
    return (hostUrl = settings);
  },
});

//get schoolName
Meteor.methods({
  getSchoolName: function() {
    let setting = _Settings.findOne({ label: 'schoolName' });
    console.log(setting);
    return (school = setting.val);
  },
});

//check for updates
Meteor.methods({
  getServerVersion: function() {
    var setting = _Settings.findOne({ label: 'version' });
    return (hostUrl = setting.val);
  },
});

//send Statistics
Meteor.methods({
  sendStatistics: function(statistics) {
    console.log('URL =' + hostUrl);
    var url = hostUrl + 'stats'; //"http://localhost:3000/stats";
    //var data = EJSON.stringify(statistics);
    try {
      const result = HTTP.call('POST', url, {
        params: { statistics: statistics, isSchool: school },
      });
      console.log(url, result);
      return true;
    } catch (error) {
      return false;
    }
  },
});

//send user accounts-base
//send Statistics
Meteor.methods({
  sendUsers: function() {
    var url = hostUrl + 'users'; //"http://localhost:3000/stats";
    //console.log(users);
    var usersData = Meteor.users.find({ 'emails.address': { $ne: 'admin@admin.com' } });
    var users = [];

    usersData.forEach(function(v) {
      users.push(v);
    });
    var size = users.length;
    users = JSON.stringify(users);

    try {
      const result = HTTP.call('POST', url, { params: { users: users, isSchool: school } });
      console.log(url, result);
    } catch (error) {
      // ignore
    }
    return size;
  },
});

//save Statistics
Meteor.methods({
  insertUsage: function(data) {
    check(data, Object);
    var id = data.id;
    var material = data.material;
    var url = data.url;
    var page = data.page;
    var user = this.userId ? data.user : 'anonymous';
    var date = data.date;
    var _id = id + user;

    if (!data.statsg) {
      //check if user has statistics.
      Meteor.users.update(
        {
          _id: user,
        },
        {
          $set: {
            'profile.stats': 1,
          },
        },
        (error, success) => {
          console.log(success); //ToDO
        },
      );
    }

    if (data.freq===undefined) {
      freq = 1;
    } else {
      freq = data.freq;
    }

    if (data.isSchool===undefined) {
      isSchool = school;
    }

    _Statistics.update(
      { _id: _id },
      {
        $set: {
          isSchool: 'isSchool',
          material,
          url,
          page,
          date,
          user,
          id,
        },
        $inc: { freq },
      },
      { upsert: true },
    );
  },
});

//save user accounts sent from remote school
Meteor.methods({
  insertUser: function(data, isSchool) {
    var id = data._id;
    var emails = data.emails;
    var profile = data.profile;
    profile['isSchool'] = isSchool;
    profile.createdAt = new Date();

    Meteor.users.update(
      { _id: id },
      { $set: { emails: emails, profile: profile } },
      { upsert: true },
    );
  },
});

//getJSONFileContent
Meteor.methods({
  getSyncContent: function(fileType, isSchool, reset) {
    var val = false;
    var status = true;
    var results = null;
    if (mCollections[fileType]===undefined) {
      return null;
    } else if (reset) {
      val = true;
      status = false;
    }

    var data = [];
    var query = {};

    query['sync.' + isSchool] = val;

    if (fileType==='egranary') {
      results = mCollections[fileType].find({});
    } else if (fileType==='admin') {
      results = mCollections[fileType].find({});
    } else {
      results = mCollections[fileType].find(query);
    }

    results.forEach(function(v) {
      let id = v._id;
      let sync = v.sync;

      if (sync===undefined) {
        sync = {};
      }

      sync[isSchool] = status;

      /*update db
     mCollections[fileType].update({_id:id},{$set:{sync:{kijabe:false,kisumu:false}}});
     **/

      //update the db. tell the sys that which school has synced
      mCollections[fileType].update({ _id: id }, { $set: { sync } });

      data.push(v);
    });
    //console.log("DATA",data);

    try {
      //console.log(JSON.parse(data));
      return data;
    } catch (e) {
      return null;
    }
  },
});

// getResource ensures resource is available on server
Meteor.methods({
  getResource: function(resourcesData) {
    Meteor.call('resetResource');
    console.log('INDEX = ' + resourceIndex, 'RESOURCES =>' + resources.length);

    if (Array.isArray(resourcesData) && resourcesData.length > 0) {
      resourceIndex = 0;
      resources = resourcesData;
      console.log('new  resources loaded ==>' + resources.length);
    } else if (resources.length===0) {
      //no resources found resources.length < 1 && Array.isArray(resourcesData)
      console.log('no resources found ');
      isSyncRuning = false;
      return; //remove in production "|| resourceIndex > 1"
    } else if (resourceIndex >= resources.length) {
      //All resources downloaded               //remove in production
      console.log('All resources downloaded => ' + resources.length);
      isSyncRuning = false;
      return;
    }

    if (!isSyncRuning) {
      return;
    }

    console.log('INDEX: ' + resourceIndex + ' TOTAL: ' + resources.length);
    var resource = resources[resourceIndex]; //assign each resouce meta-data(object) to resource variable
    resourceName = resource.name;
    resourceSize = resource.size;
    resourcePath = uploadPath + resourceName;
    downloadPath = hostUrl + 'uploads/' + resourceName;
    var fileStatus = true; //if set to false. file won't be downloaded

    //checking if file already exist on server
    fs.stat(resourcePath, function(err, stats) {
      //check if file already exists and is of the same size
      if (stats && stats.size===resourceSize) {
        //file already exist and is ok skip file
        console.log(resourceName + ' =>' + stats.size + ' <=> ' + resourceSize);
        skippedResource = true;
        console.log('skipped resource ' + resourcePath);
        resourceIndex++;
        fileStatus = false;
        isSyncRuning = false;
        skippedResource = true;
      } else if (stats && stats.size !== resourceSize && !err) {
        console.log('BROKEN FILE ' + resourceName + ' =>' + stats.size + ' <=> ' + resourceSize);

        // file already exist and is broken or needs to be replaced
        fs.unlinkSync(resourcePath); //delete file #############################
        // download missing file
        fileStatus = true;
      } else if (err && err.errno === 34) {
        //  console.log("FILE MISSING,STATS",stats,"ERROR",err);

        //file does not exit (err && err.errno === 34)
        //download missing file
        fileStatus = true;
      }
      if (isSyncRuning) {
        Fiber(function() {
          //download next file
          Meteor.call('downloadResource');
        }).run();
      } else {
        return;
      }
    });
  },
});

//get Resource progeress
Meteor.methods({
  getResourceProgress: function(resourcesData) {
    if (!isSyncRuning) {
      //return false;
    }

    // let resources =resources.length;
    //console.log(resources.length);
    return {
      resourceName: resourceName,
      resourceSize: resourceSize,
      chunkSizeDiff: chunkSizeDiff,
      chunkSize: chunkSize,
      resources: resources.length,
      resourceIndex: resourceIndex,
    };
  },
});

//resets meta data to defaults
Meteor.methods({
  resetResource: function() {
    skippedResource = false;
    resourceName = '';
    resourceSize = 0;
    chunkSize = 0;
    chunkSizeDiff = 0;
    isSyncRuning = true;
  },
});

//get Resource progeress
Meteor.methods({
  setResource: function(resource) {
    if (resource.path==='update') {
      resourcePath = updatePath + resource.name;
    } else if (resource.path==='upload') {
      resourcePath = uploadPath + resource.name;
    } else {
      isSyncRuning = false;
      return;
    }
    downloadPath = resource.downloadPath;
    skippedResource = false;
    resourceName = resource.name;
    resourceSize = resource.size;
    chunkSize = 0;
    chunkSizeDiff = 0;
    isSyncRuning = true;
  },
});

//get Resource progeress
Meteor.methods({
  downloadResource: function() {
    if (!isSyncRuning) {
      console.log('isSyncRuning is not Runing');
      return;
    }

    console.log('URL =>' + downloadPath);

    console.log(isSyncRuning, 'downloading...' + resourceName);

    var url = downloadPath;
    //create file to download
    var file = fs.createWriteStream(resourcePath);
    //var isNext =false;

    var req = http.request(url, function(response) {
      console.log('requedst sent' + resourceName);
      response.on('data', function(chunk) {
        //check progress.
        let size = chunk.length;
        //    console.log('chunk found for => '+resourceName+' SIZE =>'+resourceSize);
        //  console.log('chunk size => '+size);
        chunkSize += size;
        //   console.log('chunk progress => '+chunkSize);
        //start  downloading a new file if current file is almost done
        chunkSizeDiff = Math.floor(resourceSize - chunkSize);

        file.write(chunk);
      });

      response.on('error', function(err) {
        failedResources.push(resourceName);

        console.log('ERROR ON response: ' + err);
      });

      response.on('end', function() {
        downloadedResources.push(resourceName);
        resourceIndex++;
        isSyncRuning = false;

        console.log('DONE: ');
      });
    });

    req.on('error', e => {
      console.log('file not found => ' + resourceName + ' ' + e.message);
      failedResources.push(resourceName);
      resourceIndex++;
    });

    req.end('all resourced downloaded');
  },
});

//check if file exist on the system
Meteor.methods({
  resourceExists: function(path) {
    check(path, String);
    var status = false;

    try {
      var stats = fs.accessSync(path);
      status = true;
    } catch (e) {
      //console.log(e);
      status = false;
    } finally {
      return status;
    }
  },
});
//syncApp
WebApp.connectHandlers.use('/syncApp', function(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.writeHead(200);
  var file = req.query.file;
  var isSchool = req.query.isSchool;
  var reset = req.query.reset;

  if (file===undefined || isSchool===undefined) {
    res.end('request undefined');
  } else if (reset===undefined) {
    reset = false;
  }

  console.log('linked', file);
  var content = Meteor.call('getSyncContent', file, isSchool, reset);
  var data = [];
  var dataJSON = '';
  if (file==='resource') {
    //check to make sure that the file actually exists
    var cleanData = [];
    content.forEach(function(v) {
      let path = uploadPath + v.file['name'];
      var status = Meteor.call('resourceExists', path);
      //  console.log(status);
      if (status) {
        cleanData.push(v);
      }
    });

    var data = JSON.stringify(cleanData);
    var dataJSON = EJSON.stringify(cleanData);
  } else {
    var data = JSON.stringify(content);
    var dataJSON = EJSON.stringify(data);
  }

  res.end(dataJSON);
});

//receive Statistics

Picker.route('/stats/', function(params, req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.writeHead(200);
  var statistics = req.body.statistics;
  var isSchool = req.body.isSchool;
  //console.log('mmmmmmmmmmmmm');

  if (statistics===undefined) {
    console.log('STATAS FAILED');
    res.end('request undefined');
    return;
  }
  var stats = EJSON.parse(statistics);

  _Statistics.remove({ isSchool: isSchool }); //clear old statistics

  stats.forEach(function(v, k, arr) {
    Meteor.call('insertUsage', v, true, isSchool);
  });

  console.log('inserted statistics=> ' + stats.length);

  res.end('statistics saved to cloud');
});

//receive users accounts
Picker.route('/userss', function(params, req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.writeHead(200);
  var users = JSON.parse(req.body.users);
  var isSchool = req.body.isSchool;
  //console.log('mmmmmmmmmmmmm');

  // var users = EJSON.parse(users);
  //  var users = JSON.stringify(users)
  //console.log(users);
  if (users===undefined) {
    res.end('request undefined');
    return;
  }

  users.forEach(function(v, k, arr) {
    Meteor.call('insertUser', v, isSchool);
  });

  console.log('users inserted=> ' + users.length);

  res.end('accounts saved to cloud');
});

Meteor.methods({
  readFile: function(file) {
    var path = uploadPath + file;
    fs.open(path, 'r', (err, fd) => {
      // console.log(path);
      if (err) {
        if (err.code === 'ENOENT') {
          console.error('myfile does not exist');
          return;
        } else {
          throw err;
        }
      }
      // console.log('file',fd);
      // readMyData(fd);
    });

    // fs.readFile(pdfFilePath, (err, pdfBuffer) => {
    //    if (!err) {
    //      pdfParser.parseBuffer(pdfBuffer);
    //    }
    //  })
  },
});

//syncApp
WebApp.connectHandlers.use('/version', function(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.writeHead(200);

  var version = Meteor.call('getServerVersion');

  res.end(version);
});

//get filesize
Picker.route('/filesize/', function(params, req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.writeHead(200);
  // /fileSize?file={name}
  let resource = params.query.file;
  let path = params.query.path;
  var filePath = null; //specific path of file on the server
  console.log(resource);

  if (resource === undefined || path===undefined) {
    res.end('request undefined');
    return;
  } else if (path === 'update') {
    filePath = updatePath + resource;
  } else if (path === 'upload') {
    filePath = uploadPath + resource;
  } else {
    filePath = publicPath + resource;
  }

  fs.stat(filePath, function(err, stats) {
    if (stats) {
      res.end('' + stats.size);
      return;
    } else {
      res.end('' + -1);
      return;
    }
  });
});

Meteor.methods({
  runUpgrade: function(sudoPass, version) {
    //sh manoap.lite.sh
    const child = exec(
      ' bash ~/manoap.lite.sh',
      {
        name: 'Upgrade',
      },
      (error, stdout, stderr) => {
        if (error) {
          console.log('Error', error);
          throw error;
        } else if (stdout) {
          console.log('update sys. version');
          Fiber(function() {
            //
            var mVersion = parseFloat(version);
            var newVersion = (mVersion + 0.1).toFixed(1);
            var status = Meteor.call('updateSysVersion', newVersion);
            console.log('new version detected', newVersion, status);
          }).run();
        }
      },
    );
  },
});

Meteor.methods({
  updateSysVersion: function(version) {
    currentVer = _Settings.findOne({ label: 'version' });
    console.log('Cuurent version', currentVer, version);
    if (version > currentVer.val) {
      _Settings.update(
        {
          label: 'version',
        },
        {
          $set: {
            val: version,
          },
        },
      );
      return true;
    } else {
      return false;
    }
  },
});

//reset settings
Meteor.methods({
  resetSystemSettings: function(version) {
    _Settings.remove({});
  },
});
