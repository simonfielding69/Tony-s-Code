
// Wait for doc load
$(function(){
  URL_STR = "http://localhost:3000/"; // Const so address and port can be changed in one place
  
  
  
  /*********************************************** Find button clicked ***********************************************/
  // Find button clicked.  Use srchField as the database document key and srchTerm as the substring search
  /*******************************************************************************************************************/
  $('#btnFind').click(function () {
    var urlStr = URL_STR + "article?" + "srchField=" + $('#selSearchField').val() + "&srchTerm=" + $('#txtSearchTerm').val();
    find(urlStr);
  }); // end find button click
  
  /********************************************* Search interactively ************************************************/
  // Detect on chage to input, property or paste in text box to trigger
  // event.  In this case it triggers the find like search
  /*******************************************************************************************************************/
  $('#txtSearchTerm').on('input propertychange paste', function () {
    var urlStr = URL_STR + "article?" + "srchField=" + $('#selSearchField').val() + "&srchTerm=" + $('#txtSearchTerm').val();
    find(urlStr);
  }); // end click 
  
  /********************************************** Insert record button clicked ***************************************/
  // Insert button clicked.  Insert record in Put Data Text Area and return ID of new record to report status
  // If inserted correctly, do a search to show new insertion
  /*******************************************************************************************************************/
  $('#btnInsert').click(function () {
    var url = URL_STR + "article";
    var body = $("#idTaPutData").val();

    $.ajax({
      type: "post",
      dataType: "text", // Interpret response as text
      contentType: "application/json; charset=utf-8", // Type of data sent to server
      data: body,
      url: url,
      success: function (data) {
        $("#divStatus .content").html(data);
        //$('#btnFind').trigger('click'); // Click here to ensure ajax completed
      },
      error: function () {
        $("#divStatus .content").html("Database server returned an ERROR during insert operation");
      }
    }); // end ajax
    
    putHeader("POST", url, body);
  }); // end click
  
  /********************************************** Initialise button clicked ******************************************/
  // No data sent as it is held on the server.  Could put it here and sent it but not much point
  // Once added, do a search all to show new collection
  /*******************************************************************************************************************/
  $('#btnInitialise').click(function () {
    var url = URL_STR + "init";
    $.ajax({
      type: "post",
      dataType: "text", // Interpret response as text
      url: url,
      success: function (data) {
        $("#divStatus .content").html(data);
        //$('#btnFind').trigger('click'); // Click here to ensure ajax completed
      },
      error: function () {
        $("#divStatus .content").html("Database server returned an ERROR during insert operation");
      }
    }); // end ajax
    
    putHeader("POST", url, "empty");
  }); // end click
  
  /******************************************** DELETE record button clicked *****************************************/
  // If the collection is a collection of articles then using rest /articles/id   and the delete verb to
  // delete a specific article. Do not put a : before article number. This is an express approach to pulling 
  // out a piece of the URI as a paramerer app.del('/article/:id', function(req, res) {
  /*******************************************************************************************************************/
  $('#btnDelete').click(function () {
    var url = (URL_STR + "article/" + $('#txtSearchTerm').val());
    $.ajax({
      type: "delete",
      dataType: "text", // Interpret response as text
      url: url,
      success: function (data) {
        $("#divStatus .content").html(data); // Write result to status label
        //$('#btnFind').trigger('click'); // Click here to ensure ajax completed
      },
      error: function () {
        $("#divStatus .content").html("Last Command: ERROR writing to database");
      }
    }); // end ajax
    
    putHeader("DELETE", url, "empty");
  }); // end click
  
  /******************************************** DELETE ALL button clicked ********************************************/
  // Drop the collection then do a search to show all have gone
  /*******************************************************************************************************************/
  $('#btnDeleteAll').click(function () {
    var url = URL_STR + "article/all";
    $.ajax({
      type: "delete",
      dataType: "text", // Interpret response as text
      url: url,
      success: function (data) {
        $("#divStatus .content").html(data); // Write result to status label
      },
      error: function () {
        $("#divStatus .content").html("Last Command: ERROR writing to database");
      }
    }); // end ajax
    
    putHeader("DELETE", url, "empty");
  }); // end click
  
  
  /*********************************************** UPDATE button clicked ********************************************/
  // Put JSON resord in the text fiels and provide a valid _id and it will be updated.  Not added all error trapping
  // at this end or server for things like invalid ID, and return error code check. If successful, do a search on
  // the ID to show the change.
  /*******************************************************************************************************************/
  $('#btnUpdate').click(function(){
    var url = (URL_STR + "article/" + $('#txtSearchTerm').val());
    var body = $("#idTaPutData").val(); // the idTaPutData must bein JSON format
    
    $.ajax({ 
      type: "put",
      dataType: "text", // Interpret response as text
      contentType: "application/json; charset=utf-8", // Type of data sent to server
      data: body, 
      url: url,
      success: function(data){  
                 var str = data;
                 $("#divStatus .content").html(data);
                 //$('#btnFind').trigger('click'); // Click here to ensure ajax completed
               },
      error: function(err){
              $("#divStatus .content").html("ERROR updating document");      
             }       
    }); // end ajax
    
    putHeader("PUT", url, body);
  }); // end click
  
  
  /**************************************************** Find *********************************************************/
  //
  // ajax call for all find functions.  Take formed url and send get request to server. Expect json response
  // containg found documents.  If server returns sucess, write status and result. If error, write 
  // response text from err object as I return a string indicating the type of error and error status 412 to
  // indicate client error.
  /*******************************************************************************************************************/
  function find(url) {
    $.ajax({
      type: "get",
      dataType: "json",
      url: url,
      success: function (data) {
        $("#divStatus .content").html("Database search SUCCESSFUL");   // Update status
        $('#idTaGetData').val(JSON.stringify(data, null, 2)); // Write returned data into Get Data text area
        putData(data, '#idTaPutData'); // Copy first element to edit area to save typing and provide format
      },
      error: function (err) { // err has loads of methods.  Used responseText to return error message from server
        $("#divStatus .content").html("Database server returned an ERROR (" + err.status + "): "+ err.responseText);
      }
    }); // end ajax
    
    putHeader("GET", url, "empty");
    //$("#divHttpVerb").html("<span class='title'>GET: </span>" + searchUrl + "<br>Body: empty");
  }
  
  /******************************************* putData to output text field *****************************************/
  // input args: jsonData, Array of objects holdiing data to format and output. 
  //             whereTo, string with dest ination ID
  //             
  // This only handles a single record and field to simplify the
  // operation of the demo only.  i.e. stuff from result such as id are removed to leave an easily updatable JSON
  // object to modify for update or insert.
  // If need more addresses add num param and loop on x in jsonData
  /******************************************************************************************************************/
  function putData(jsonData, whereTo) {
    if (jsonData.length > 0) $(whereTo).val('{ "address" : "' + jsonData[0].address + '" }');
  }
  
  function putHeader(verb, url, body){
    $("#headerUrl .title").html(verb + ": ");
    $("#headerUrl .content").html(url);
    $("#headerBody .title").html("Body: ");
    $("#headerBody .content").html(body);
  }
  
}); // End wait for doc load
