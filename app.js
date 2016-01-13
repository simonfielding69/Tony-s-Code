/* Random address gen.  Use macro in ultra edit to add { }, etc */
/* http://www.doogal.co.uk/RandomAddresses.php */
/* Response codes at http://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html */

//Using  REST as defined
//GET    Retrieve the resource from the server
//POST   Create a resource on the server
//PUT    Update the resource on the server
//DELETE Delete the resource from the server

var express = require('express'), routes = require('./routes'), user = require('./routes/user'), http = require('http'), path = require('path');

var app = express(); // Instantiate express and return object assigned to app with various methods get,post,put,head

// Initialise database connections and collection
var mongo = require('mongodb');
var monk = require('monk');  // A Wrapper on top of mongo to make connection simpler.  Based on Mongoskin
var db = require('monk')('localhost/kbase'); // kbase is the name of the database created using mongo
var articles = db.get('articles'); // articles is a collection in the kbase
var store = db.articles;           // use store to simplify access to the articles collection

// all environments
app.set('port', process.env.PORT || 3000); // Set server port
app.set('views', __dirname + '/views'); // Point to rendering views
app.set('view engine', 'jade'); // Template engine to render views
app.use(express.favicon());
app.use(express.logger('dev')); // Use various express middleware components
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public'))); // Set path to public


// development only
if ('development' === app.get('env')) {
  app.use(express.errorHandler());
}

/******************************************** Create and start server *******************************************************/
//
// Create http server and start it.  Listen for http requests on provided port i.e. the :xxxx in the url
//
/****************************************************************************************************************************/
http.createServer(app).listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});


/*
 * Cross Origin Resource Sharing (CORS) or cross site AJAX Caused me a lot of grief Following may not be absolutely
 * right but works with all verbs
 * 
 * When javascript is requested from a web page using AJAX when the two are in different domains then the browser can
 * make the request but the server needs to check that the request from that domain is allowed. The browser sends the
 * request origin e.g. in my case localhost:3000 Although the node server is also at local host, because it is on a
 * different port, this seems to be enough to trigger the CORS issue. The browser's origin needs to be checked by the
 * server and if on its list (or * for anywhere) is returned then the browser will accept the response. Using
 * res.setHeader("Access-Control-Allow-Origin", "*"); to return the permission, the response is accepted. Sometimes the
 * browser will sent an OPTIONS header to request the options it should accept but sometime it doesn't send it. e.g. in
 * this test, GET request didn't send the request but PUT did. The OPTIONS request needs to be responded to and all the
 * requests, GET, PUT, POST and DELETE seem to need the access control to be returned so to handle this I trap all
 * requests in a app.all function. app.use can also be used but the code needs to appear before the app.use(app.router);
 * statement. app.all sends the response headers back for all requests but if it was an OPTION request, it returns with
 * no content return( res.end() whereas if it was another request type, next() is called to check for an appropriate
 * handler.
 * 
 */
/*
 * could use app.use app.use(function (req, res, next) { console.log('Called on every request'); next(); // pass control
 * to the next handler });
 * 
 * but this needs to go before the app.use(app.router); statement. app.all is called when in the router so i'll use this
 */

/********************************************** app.all for OPTIONS *********************************************************/
// app.all()
//
// This is called for all requests so I can trap the OPTIONS request if the browser sends one which happens if the requested
// page is in a different domain than the browser page requesting it. Return access control and do nothing if OPTIONS
//but pass on to other handlers if not.  This enables CORS from all domains.
// Create response header for the browser indicating that it should call this service using the 4 verbs despite it being in
// a diggerent domain as the web page is currently provided from one server and this is on another.
/****************************************************************************************************************************/

app.all('*', function(req, res, next) {
  var origin = (req.headers.origin || "*");
  {
    

    if (req.method.toUpperCase() === "OPTIONS") {
      console.log("OPTIONS sent");
      res.setHeader("Access-Control-Allow-Origin", origin);
    res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
      return (res.end()); // Response headers for OPTIONS complete, otherwise jump to next handler
    }
  } // end if

  next(); // pass control to the next handler
}); // end app.all


/****************************************************** Search for document using GET ***************************************/
//
// e.g. url: http://localhost:3000/find?srchField=body&srchTerm=This is the body of the trie
// will connect to local host port 3000 routed to find.  Parameter srchField in this case is "body" so will search the 
// body field of the documents in the collection. srchTerm is the substring "This is the body of the trie" in the body data
// of the document.  
// srchField takes 3 different parameter types in the request header: 
// 1. Search field has a * and it finds all documents containing the srchTerm
// 2. Search field has a unique _id it needs an exact id won't search on substring. Returns single document.
// 3.  Anything else is searched on substring provided in the header in all docs with a "body" field.
//
// Returns: JSON string with error or result
//
// req.params contains route parameters (in the path portion of the URL), 
// and req.query contains the URL query parameters (after the ? in the URL).
// given the url: http://localhost:3000/find?srchField=body&srchTerm=This is the body of the trie
// Could have used http://localhost:3000/find/body/This is the body of the trie
// req.query will be: {srchField: 'body', srchTerm: 'This is the body of the trie' }
// req.params will be:  {param1: 'find'}
/****************************************************************************************************************************/
app.get('/article', function(req, res) {
  var myQuery = {};
  var resSent = false;

  if (req.query.srchField === "*") {
    // Leave query empty for wildcard search
  } else if (req.query.srchField === '_id') {
    if (req.query.srchTerm.length !== 24) {
      resSent = true;
      res.status(412); // Tell client a pre-condition failed (_id wrong length in this case). 400 codes reserved for
                        // client error
      res.json("Document ID is invalid");
    } else {
      myQuery[req.query.srchField] = req.query.srchTerm; // create {srchField:srchTerm} req.query.srchField evaluates
                                                         // to a string such as body, or *, or _id so need to use []
    }
  } else {
    myQuery[req.query.srchField] = new RegExp(req.query.srchTerm, 'i'); // Create {srchField:/srchTerm/} regex. ,'i' for
                                                                        // case insensitive
  }

  if (!resSent) {
    // Find the document in the articles collection. The callback function from find will have an error value and result
    articles.find(myQuery, function(err, result) {
      if (err) {
        res.json(err);
      } else {
        res.json(result); // Send found result back as a JSON string
      }
    }); // end .find
  }
}); // end .get



/************************************************** insert document using POST **********************************************/
// Insert a new doc into the collection
//
// e.g. http://localhost:3000/insert with body  "{ "address" : "London Rd, Purfleet, Essex RM19 1SB, UK" }"
//
// Route on insert and insert body
// returns: string with error or a success string on the document ID
//          e.g. "Written document ID = 5671aa7432e76d8c14e69d36 to database."
//
/****************************************************************************************************************************/
app.post('/article', function(req, res) {
  var payload;

  payload=req.body; // Get the body to insert.
  articles.insert(payload, function(err, result) {
    if (err) {       
      console.log("err :"+ err.err); 
      res.send(err.err);  // Send the main part of the error object as a string
    } else {
      res.send("Written document ID = " + result._id + " to database.");
    }
  }); // end .insert
}); // end .post


/************************************************* update document using PUT ***********************************************/
// Update a document.  Need to provide doc ID and new values
//
// input args: route on article with param doc ID.
// return: string with error or success with doc ID
//
// e.g. Same as insert but need to provide doc ID which needs to exist and body has new data
//
// Search for whole doc on ID.  If error ofr doc not found, return string.  Otherwise, pass body object to updateById
// content of each field to the record to update it
//
// Details on update syntax at https://www.npmjs.com/package/monk
// users.update({}, {}, fn);
// users.updateById('id', {}, fn);
//
/****************************************************************************************************************************/
app.put('/article/:id', function(req, res) {
  var docId = req.params.id;

  // findOne return the document not just a cursor
  articles.findOne({ _id : req.params.id}, function(err, article) {
    if (err) {
      return res.send("Database error: " + err);
    } else if (article === null) {
      res.send("Could not find document " + docId + " to update");
    }

    articles.updateById(req.params.id, req.body, function(err) {
      if (err) {
        return res.send(err);
      }

      res.send("Document " + docId + " updated");
    }); // end .updateById
  }); // end .findOne
}); //end .put
 
  
/********************************************* Delete document using DELETE *************************************************/
// Input: route on collection name and id param is the document unique ID. If param = all then drop the collection
// return: string
//
//  delete if primary key provided - i.e. _id
//  Change article later to read req.params to enable other collections not just articles
//
//  example url: http://localhost:3000/article/56549bff805b1474170b9152
//  delete implied as delete is the header verb
//
/****************************************************************************************************************************/
app.del('/article/:id', function(req, res) {
 var param=req.params.id; // id is the unique id passed over e.g. "565493db805b1474170b9150"
 var query = {};

 if (param === "all") {
  if (articles.drop()) {
   console.log("Just deleted the lot!");
   res.send("Deleted all documents from collection");
  } else {
     res.send("Database returned an error when trying to delete all documents from collection");
    }
 } else {
    query._id=req.params.id;
    articles.remove(query, function(err, result) {
     if (err) {
      return res.send('Error deleting document ' + req.params.id);
     } else {
        res.send("Deleted document with id=" + param); // end res.send
       }
     }); // end .remove
   }
});  //  end .del


/************************************************* INITIALISE ***************************************************************/
// For testing, add some useful data into the collection
//
// Input arg: post /init
// Return: string with error or success message
//
/****************************************************************************************************************************/
app.post('/init', function(req, res) {
  var docs = [
    { address: "4 Roddymoor Ct, Roddymoor, Crook, County Durham DL15 9RW, UK"},
    { address: "185 Delaval Rd, Newcastle upon Tyne, Tyne and Wear NE15 6TR, UK"},
    { address: "Epping Green, Hertford, Hertfordshire SG13, UK"},
    { address: "London Rd, Purfleet, Essex RM19 1SB, UK"},
    { address: "Unnamed Road, Malvern, Worcestershire WR13 5EG, UK"},
    { address: "1 Camilla St, Halkirk, Highland KW12 6YQ, UK"},
    { address: "6 Rural Cottages, Church Preen, Church Stretton, Shropshire SY6 7LE, UK"},
    { address: "4 St Barnabas Rd, Woodford, Woodford Green, Greater London IG8 7DA, UK"},
    { address: "49A Emmanuel Rd, London SW12 0HN, UK"},
    { address: "2 Hobart Croft, Birmingham, West Midlands B7 4JN, UK"},
    { address: "19 Brook St, Neston, Cheshire West and Chester CH64 9XJ, UK"},
    { address: "4 Alberta Cres, Exeter, Devon EX4 7JT, UK"},
    { address: "21 Ashburnham Rd, South Queensferry, Edinburgh EH30 9JL, UK"},
    { address: "2 Cottingham Dr, Middlesbrough, Middlesbrough TS3 8LB, UK"},
    { address: "67 Coul Park, Alness, Highland IV17 0RA, UK"},
    { address: "2 Lutton Grove, Peterborough, Peterborough PE3 7DY, UK"},
    { address: "369 Union Rd, Oswaldtwistle, Accrington, Lancashire BB5 3NS, UK"},
    { address: "8 Belvide Grove, Birmingham, West Midlands B29 5ED, UK"},
    { address: "12 Rannoch Rd, Wemyss Bay, Inverclyde PA18 6DD, UK"},
    { address: "110 Furness Rd, London NW10 5UG, UK"},
    { address: "80 Cheapside, London EC2V 6DZ, UK"},
    { address: "48/2 London Rd, Edinburgh, Edinburgh EH7 5SP, UK"},
    { address: "6 Priestley Cl, Pudsey, West Yorkshire LS28 9NJ, UK"},
    { address: "57 Shelfield Rd, Birmingham, West Midlands B14 6JT, UK"},
    { address: "11 Ingles, Welwyn Garden City, Hertfordshire AL8 7HE, UK"},
    { address: "8 Aldwickbury Cres, Harpenden, Hertfordshire AL5 5RP, UK"},
    { address: "A39, Lynmouth, Devon EX35 6NA, UK"},
    { address: "Unnamed Road, Solihull, Warwickshire B94 5AE, UK"},
    { address: "7 Pennine View, Burrells, Appleby-in-Westmorland, Cumbria CA16 6EF, UK"},
    { address: "4 Marlborough Rd, Hadley, Telford, Telford and Wrekin TF1 5LN, UK"},
    { address: "13 Musgrave St, Birstall, Batley, West Yorkshire WF17 9PF, UK"},
    { address: "Unnamed Road, Isle of Mull, Argyll and Bute, UK"},
    { address: "9 Milton Grove, Armthorpe, Doncaster, South Yorkshire DN3 3BX, UK"},
    { address: "37 Thayer St, Marylebone, London W1U 2QU, UK"},
    { address: "186/1 Rose St, Edinburgh, Edinburgh EH2 4BA, UK"},
    { address: "145 Bicester Rd, Kidlington, Oxfordshire OX5 2PX, UK"},
    { address: "3 Caudle Ln, Ruardean, Gloucestershire GL17 9TL, UK"},
    { address: "39 Liscard Village, Wallasey, Merseyside CH45, UK"},
    { address: "6 Llwyn Derwen, North Cornelly, Bridgend, Bridgend CF33 4BH, UK"},
    { address: "25 Garner Dr, Broxbourne, Hertfordshire EN10 6AU, UK"},
    { address: "3 Langley Hall Rd, Sutton Coldfield, West Midlands B75 7NG, UK"},
    { address: "Close Ln, Devizes, Wiltshire SN10 5SN, UK"},
    { address: "16 Flaxpits Ln, Winterbourne, Bristol, South Gloucestershire BS36 1LA, UK"},
    { address: "58 Ruffa Ln, Pickering, North Yorkshire YO18 7HN, UK"},
    { address: "1 De Burgh Park, Banstead, Surrey SM7 2PP, UK"},
    { address: "12 Upper Gough St, Birmingham, West Midlands B1 1JG, UK"},
    { address: "A420, Chippenham SN14, UK"},
    { address: "93 St Andrews Dr, Bridge of Weir, Renfrewshire PA11 3JD, UK"},
    { address: "5 Dale Rd, Matlock, Derbyshire DE4 3LT, UK"},
    { address: "Kilham Rd, Driffield, East Riding of Yorkshire YO25, UK"},
    { address: "1 Copse Cl, Burton Joyce, Nottingham, Nottinghamshire NG14 5DD, UK"},
    { address: "17 Longacres, Bridgend, Bridgend CF31 2DD, UK"},
    { address: "3 Purley Ford, Luxborough, Watchet, Somerset TA23 0SA, UK"},
    { address: "18-19 Old Buildings, London WC2A 3UP, UK"},
    { address: "13 The Promenade, Withernsea, East Riding of Yorkshire HU19 2DP, UK"},
    { address: "130 Brackenwood Dr, Leeds, West Yorkshire LS8 1PZ, UK"},
    { address: "62 Alderwood Rd, London SE9 2LB, UK"},
    { address: "278 Moorfield, Harlow, Essex CM18 7QW, UK"},
    { address: "2 Campbell Ave, Dunbeath, Highland KW6 6EB, UK"},
    { address: "57A Goodacre St, Mansfield, Nottinghamshire NG18 2HH, UK"},
    { address: "9 Rougier St, York, York YO1, UK"},
    { address: "7 Lord Warden's Chase, Bangor, North Down BT19 1YX, UK"},
    { address: "10 Vicarage Gardens, Wrawby, Brigg, North Lincolnshire DN20 8SA, UK"},
    { address: "2 Townhead, Lochgoilhead, Cairndow, Argyll and Bute PA24 8AQ, UK"},
    { address: "B6357, Canonbie, Dumfries and Galloway DG14 0RP, UK"},
    { address: "45 Milton Rd, Carcroft, Doncaster, South Yorkshire DN6 8QL, UK"},
    { address: "13-15 St. Huberts St, Great Harwood, Blackburn, Lancashire BB6 7BE, UK"},
    { address: "17 Mountway, Potters Bar, Hertfordshire EN6 1ER, UK"},
    { address: "16 Dolfach, Newtown, Powys SY16 1LL, UK"},
    { address: "98 Oxford Rd, Uxbridge, Greater London UB8 1LZ, UK"},
    { address: "3 Charles St, Brecon, Powys LD3 7HF, UK"},
    { address: "2 Avondale Gardens, West Boldon, East Boldon, Tyne and Wear NE36 0PS, UK"},
    { address: "83-84 Easton St, High Wycombe, Buckinghamshire HP11 1NF, UK"},
    { address: "Bickenhill Ln, Marston Green, Birmingham, West Midlands B40 1PQ, UK"},
    { address: "Unnamed Road, Liphook, West Sussex GU30, UK"},
    { address: "2 Croft Terrace, Cockermouth, Cumbria CA13 9RE, UK"},
    { address: "2 Dunkirks Mews, Hertford, Hertfordshire SG13 8BA, UK"},
    { address: "50 Lowndes Grove, Shenley Church End, Milton Keynes, Milton Keynes MK5 6EG, UK"},
    { address: "19 Raccoon Way, Hounslow, Greater London TW4 7PL, UK"},
    { address: "23 Pentland View Terrace, Roslin, Midlothian EH25 9LZ, UK"},
    { address: "15 Castle Grove, Longforgan, Dundee, Perth and Kinross DD2 5HZ, UK"},
    { address: "14 Petter Cl, Wroughton, Swindon, Swindon SN4 9SF, UK"},
    { address: "A39, High Littleton, Bristol, Bath and North East Somerset BS39, UK"},
    { address: "2 Lanchester Cl, Herne Bay, Kent CT6 8AH, UK"},
    { address: "14 Hardy St, Bradford, West Yorkshire BD6 1NL, UK"},
    { address: "22 Kynon Gardens, Bognor Regis, West Sussex PO22 6RF, UK"},
    { address: "A1(M), Durham, County Durham, UK"},
    { address: "54A Elm Grove, Portsmouth, Southsea, Portsmouth PO5 1JG, UK"},
    { address: "B9031, Fraserburgh, Aberdeenshire AB43, UK"},
    { address: "B480, Watlington, Oxfordshire OX49, UK"},
    { address: "Unnamed Road, Dymock, Gloucestershire GL18, UK"},
    { address: "48 Cadogan Rd, Surbiton, Greater London KT6 4DJ, UK"},
    { address: "25 Batworth Dr, Sheffield, South Yorkshire S5 8XW, UK"},
    { address: "233 Galmington Rd, Taunton, Somerset TA1, UK"},
    { address: "81 Westminster Rd, Leek, Staffordshire ST13 6NZ, UK"},
    { address: "34 Claremont St, Aberdeen, Aberdeen City AB10, UK"},
    { address: "21 Prince St, Bristol, City of Bristol BS99 7JG, UK"},
    { address: "178 Long Rd, Lawford, Manningtree, Essex CO11 2EF, UK"},
    { address: "Riverside Way, Camberley, Surrey GU15, UK"},
    { address: "1 Horsepond Rd, Gallowstree Common, Reading, Oxfordshire RG4 9BT, UK"}
  ];
  
  
  articles.drop(); // Clear the collection before initialising with new data
  
  articles.insert(docs, function(err, result) {
    if (err) {              
      res.send(err.err);  // Send the main part of the error object as a string
    } else {
        res.send("Initialised collection");
      }
  }); // end .insert
}); // end .post
  



