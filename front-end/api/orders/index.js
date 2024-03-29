(function (){
  'use strict';

  var async     = require("async")
    , express   = require("express")
    , request   = require("request")
    , endpoints = require("../endpoints")
    , helpers   = require("../../helpers")
    , app       = express()
    , service   = require('../service')

  app.get("/orders", function (req, res, next) {
    console.log("Request received with body: " + JSON.stringify(req.body));
    var logged_in = req.cookies.logged_in;
    if (!logged_in) {
      throw new Error("User not logged in.");
      return
    }

    var custId = req.session.customerId;
    async.waterfall([
        function (callback) {

        var ordersEndpoint = endpoints.ordersUrl;
        var ordersUrl = "http:" +  ordersEndpoint.split(':')[1] + ":7079";
        console.log("/orders Request --> orderUrl & port", ordersUrl);
        request(ordersUrl + "/orders/search/customerId?sort=date&custId=" + custId, function (error, response, body) {

            if (error) {
              return callback(error);
            }
            console.log("/orders Reponse ---->   " + JSON.stringify(body));
            if (response.statusCode == 404) {
              console.log("No orders found for user: " + custId);
              return callback(null, []);
            }
            callback(null, JSON.parse(body)._embedded.customerOrders);
          });
        }
    ],
    function (err, result) {
      if (err) {
        return next(err);
      }
      helpers.respondStatusBody(res, 201, JSON.stringify(result));
    });
  });

  app.get("/orders/*", function (req, res, next) {
    var ordersEndpoint = endpoints.ordersUrl;
    var ordersUrl = "http:" +  ordersEndpoint.split(':')[1] + ":7079";  
    var url = ordersUrl + req.url.toString();
    //var url = "http://localhost:7079/" + req.url.toString();
    console.log("/orders/* --> url", url);
    request.get(url).pipe(res);
  });

  app.post("/orders", function(req, res, next) {
    console.log("Request received with body: " + JSON.stringify(req.body));
    var logged_in = req.cookies.logged_in;
    if (!logged_in) {
      throw new Error("User not logged in.");
      return
    }

    var custId = req.session.customerId;

    async.waterfall([
        function (callback) {
          var options = {
            headers: service.headers,
            uri: "http://user/customers/" + custId,
            proxy: service.proxy,
            method: 'GET'
          };
          request(options, function (error, response, body) {
            if (error || body.status_code === 500) {
              console.log("making this req http://user/customers/custid", error);
              callback(error);
              return;
            }
    //        var jsonData = {"firstName":"User","lastName":"Name","username":"user","id":"57a98d98e4b00679b4a830b2","_links":{"addresses":{"href":"http://localhost:7074/customers/57a98d98e4b00679b4a830b2/addresses"},"cards":{"href":"http://localhost:7074/customers/57a98d98e4b00679b4a830b2/cards"},"customer":{"href":"http://localhost:7074/customers/57a98d98e4b00679b4a830b2"},"self":{"href":"http://localhost:7074/customers/57a98d98e4b00679b4a830b2"}}};
            //console.log("Received response1: " + JSON.stringify(jsonData));
            //var jsonBody = jsonData;
            var jsonBody = JSON.parse(body);
            console.log("jsonbody "+jsonBody);
            var customerlink = jsonBody._links.customer.href;
            var addressLink = "http://user/customers/"+custId+"/addresses";
            var cardLink = "http://user/customers/"+custId+"/cards";
            var order = {
              "customer": customerlink,
              "address": null,
              "card": null,
              "items": "http://carts/carts/" + custId + "/items"
            };
            callback(null, order, addressLink, cardLink);
          });
        },
        function (order, addressLink, cardLink, callback) {
          async.parallel([
              function (callback) {
                console.log("GET Request to: addressLink --> " + addressLink);
                 var req = request.defaults({
                  proxy: service.proxy,
                  headers: service.headers
                 });
                req.get(addressLink, function (error, response, body) {
                  if (error) {
                    console.log("err in addr link ",error)
                    callback(error);
                    return;
                  }
                  //var jsonData = {"_embedded":{"address":[{"street":"Whitelees Road","number":"246","country":"United Kingdom","city":"Glasgow","postcode":"G67 3DL","id":"57a98d98e4b00679b4a830b0","_links":{"address":{"href":"http://localhost:7074/addresses/57a98d98e4b00679b4a830b0"},"self":{"href":"http://localhost:7074/addresses/57a98d98e4b00679b4a830b0"}}}]}};
                  var jsonBody = JSON.parse(body);
                  console.log("jsonbody in addr link"+jsonBody)
                  //console.log("Received response2: " + jsonData);
                  //var jsonBody = jsonData;
                  if (jsonBody.status_code !== 500 && jsonBody._embedded.address[0] != null) {
                    order.address = jsonBody._embedded.address[0]._links.self.href;
                    console.log(order.address + "order address")
                  }
                  callback();
                });
              },
              function (callback) {
                console.log("GET Request to: card Link --> " + cardLink);
                var req = request.defaults({
                  proxy: service.proxy,
                  headers: service.headers
                 });
                req.get(cardLink, function (error, response, body) {
                  if (error) {
                    console.log(error,"error in card link")
                    callback(error);
                    return;
                  }
                  //var jsonData = {"_embedded":{"card":[{"longNum":"5544154011345918","expires":"08/19","ccv":"958","id":"57a98d98e4b00679b4a830b1","_links":{"card":{"href":"http://localhost:7074/cards/57a98d98e4b00679b4a830b1"},"self":{"href":"http://localhost:7074/cards/57a98d98e4b00679b4a830b1"}}}]}};
                  //var jsonBody = jsonData;
                  //var jsonBody = JSON.parse(body); 
                  //console.log("Received response3: " + jsonBody);

                  console.log("Received response card Link: " + JSON.stringify(body));
                  var jsonBody = JSON.parse(body);

                  if (jsonBody.status_code !== 500 && jsonBody._embedded.card[0] != null) {
                    order.card = jsonBody._embedded.card[0]._links.self.href;
                  }
                  console.log(order.card, "card detail")
                  callback();
                });
              },
               function (callback) {
                console.log("GET Request to: order.items Link --> " + order.items);
                var req = request.defaults({
                  proxy: service.proxy,
                  headers: service.headers
                 });
                req.get(order.items, function (error, response, body) {
                  if (error) {
                    console.log(error,"error in order.items link")
                    callback(error);
                    return;
                  }
                  //var jsonData = [{"id":"599c8959fba528000618cc61","itemId":"3395a43e-2d88-40de-b95f-e00e1502085b","quantity":1,"unitPrice":18.0}];
              

                  console.log("Received response order.items Link: " + JSON.stringify(body));
                  var jsonBody = JSON.parse(body);

                  if (jsonBody.status_code !== 500 && jsonBody[0].unitPrice != null) {
                    order.items = jsonBody;
                  }
                  console.log(order.items, "order.items response detail");
                  callback();
                });
              }
          ], function (err, result) {
            if (err) {
              console.log(err,"error")
              callback(err);
              return;
            }
            console.log(result);
            callback(null, order);
          });
        },
        function (order, callback) {
          var options = {
            uri: endpoints.ordersUrl + '/orders',
            method: 'POST',
            json: true,
            body: order
          };
          console.log("POST: /orders" + endpoints.ordersUrl + '/orders');
          console.log("Posting Order: " + JSON.stringify(order));
          request(options, function (error, response, body) {
            if (error) {
              console.log(error,"order endpoint")
              return callback(error);
            }
            console.log("Order response: " + JSON.stringify(response));
            console.log("Order response: " + JSON.stringify(body));
            callback(null, response.statusCode, body);
          });
        }
    ],
    function (err, status, result) {
      if (err) {
        console.log(err,"last callback")
        return next(err);
      }
      console.log("req to helpers")
      helpers.respondStatusBody(res, status, JSON.stringify(result));
    });
  });

  module.exports = app;
}());
