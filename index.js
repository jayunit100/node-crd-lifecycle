const express = require('express');
const app = express();
const path = require('path');
const got = require('got');
require('dotenv').config()
const { google } = require('googleapis');
const sqlAdmin = google.sqladmin('v1beta4');
const token = process.env.TOKEN;
const util = require('./util');

// http server setup

app.use(express.json());
app.use('/static', express.static(path.join(__dirname, 'client', 'build', 'static')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'build', 'index.html'));
});

app.listen(3001, () => console.log('Node server running on port 3001'))

// http client

// TODO read from config map
// mock url
// const baseUrl = "http://35.192.173.23:15472";
// prod url
const baseUrl = "http://35.202.46.218:15472";
//const baseUrl = "http://cn-crd-controller:15472";
const urls = {
    "crudHub": `${baseUrl}/hub`,
    "getModel": `${baseUrl}/model`
};

// routes

app.get('/api/instances', (req, res) => {
    if (!util.tokenIsInvalid({ req, res, token })) {
        console.log('Fetch Instances:', util.formatDate(new Date()));
        util.getModel({ httpLib: got, urls })
            .then((resp) => {
                res.setHeader('Content-Type', 'application/json');
                res.send(resp.body);
            })
            .catch((error) => {
                console.log(error);
                res.status(500).json(error);
            })
    }
})

app.post('/api/instances', (req, res) => {
    if (!util.tokenIsInvalid({ req, res, token })) {
        util.createInstance({
            httpLib: got,
            urls,
            body: req.body
        })
            .then((resp) => {
                res.send('Instance created');
            })
            .catch((error) => {
                console.log(error);
                res.status(500).json(error);
            })
    }
})

// TODO could/should these be pulled in from cn-crd-controller?
app.get('/api/sql-instances', (req, res) => {
    if (!util.tokenIsInvalid({ req, res, token })) {
        console.log('Authorize Cloud SQL:', util.formatDate(new Date()));
        authorize(function(authClient) {
          var request = {
            project: 'gke-verification',
            auth: authClient,
          };

          var handlePage = function(err, response) {
            if (err) {
              console.error(err);
              return res.status(500).json({ error: 'SQL Instances failed to load, blame Google' });
            }

            const dbInstances = response.data.items.map((instance) => instance.name);
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(dbInstances));
            //TODO: check for multiple pages
            // if (response.nextPageToken) {
            //   request.pageToken = response.nextPageToken;
            //   sqlAdmin.instances.list(request, handlePage);
            // }
          };

          sqlAdmin.instances.list(request, handlePage);
        });
    }
})

// business logic

function sum(nums) {
  return nums.reduce((b, a) => b + a, 0);
}

function getPodsNotRunningCount(podStatuses) {
    const counts = Object.keys(podStatuses)
        .map(function (k) {
            if (k === "Running") {
                return 0;
            }
            return podStatuses[k].length;
        });
    return sum(counts);
}

//TODO: use reduce
function getBadEventsCount(events) {
  let total = 0;
  for (var key in events) {
    if (key !== "Running") {
      total += events[key];
    }
  }
  return total;
}

function authorize(callback) {
  google.auth.getApplicationDefault(function(err, authClient) {
    if (err) {
      console.error('authentication failed: ', err);
      return;
    }
    if (authClient.createScopedRequired && authClient.createScopedRequired()) {
      var scopes = ['https://www.googleapis.com/auth/cloud-platform'];
      authClient = authClient.createScoped(scopes);
    }
    callback(authClient);
  });
}
