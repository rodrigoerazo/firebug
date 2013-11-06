/* See license.txt for terms of usage */

/*jshint esnext:true, es5:true, curly:false*/
/*global FBTrace:true, Components:true, define:true */


define([
    "firebug/lib/wrapper",
],
function(Wrapper) {

"use strict";

// ********************************************************************************************* //
// Constants

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;

// Debuggees
var dbgGlobalWeakMap = new WeakMap();

// Module object
var DebuggerLib = {};

// ********************************************************************************************* //
// Implementation

/**
 * Unwraps the value of a debuggee object. Primitive values are also allowed
 * and are let through unharmed.
 *
 * @param obj {Debugger.Object} The debuggee object to unwrap, or a primitive
 *
 * @return {object} the unwrapped object, or the same primitive
 */
DebuggerLib.unwrapDebuggeeValue = function(obj, global, dglobal)
{
    // If not a debuggee object, return it immediately.
    if (typeof obj !== "object" || obj === null)
        return obj;

    if (obj.unsafeDereference)
        return Wrapper.unwrapObject(obj.unsafeDereference());

    // Define a new property to get the debuggee value.
    dglobal.defineProperty("_firebugUnwrappedDebuggerObject", {
        value: obj,
        writable: true,
        configurable: true
    });

    // Get the debuggee value using the property through the unwrapped global object.
    return global._firebugUnwrappedDebuggerObject;
};

/**
 * Gets or creates the debuggee global for the given global object
 *
 * @param {*} context The Firebug context
 * @param {Window} global The global object
 *
 * @return {Debuggee Window} The debuggee global
 */
DebuggerLib.getDebuggeeGlobal = function(context, global)
{
    global = global || context.getCurrentGlobal();

    var dbgGlobal = dbgGlobalWeakMap.get(global.document);
    if (!dbgGlobal)
    {
        var dbg = getInactiveDebuggerForContext(context);
        if (!dbg)
            return;

        // xxxFlorent: For a reason I ignore, there are some conflicts with the ShareMeNot addon.
        //   As a workaround, we unwrap the global object.
        //   TODO see what cause that behaviour, why, and if there are no other addons in that case.
        var contentView = Wrapper.getContentView(global);
        if (dbg.makeGlobalObjectReference)
        {
            dbgGlobal = dbg.makeGlobalObjectReference(contentView);
        }
        else
        {
            dbgGlobal = dbg.addDebuggee(contentView);
            dbg.removeDebuggee(contentView);
        }
        dbgGlobalWeakMap.set(global.document, dbgGlobal);

        if (FBTrace.DBG_DEBUGGER)
            FBTrace.sysout("new debuggee global instance created", dbgGlobal);
    }
    return dbgGlobal;
};

/**
 * Returns true if the frame location refers to the command entered by the user
 * through the command line.
 *
 * @param {string} frameLocation
 *
 * @return {boolean}
 */
// xxxHonza: should be renamed. It's not only related to the CommandLine, but
// to all bogus scripts, e.g. generated from 'clientEvaluate' packets.
DebuggerLib.isFrameLocationEval = function(frameFilename)
{
    return frameFilename === "debugger eval code" || frameFilename === "self-hosted";
}

// ********************************************************************************************* //
// Local helpers

/**
 * Gets or creates the Inactive Debugger instance for the given context (singleton).
 *
 * @param context {*}
 *
 * @return {Debugger} The Debugger instance
 */
var getInactiveDebuggerForContext = function(context)
{
    var DebuggerClass;
    var scope = {};

    if (context.inactiveDebugger)
        return context.inactiveDebugger;

    try
    {
        Cu.import("resource://gre/modules/jsdebugger.jsm", scope);
        scope.addDebuggerToGlobal(window);
        DebuggerClass = window.Debugger;
    }
    catch (exc)
    {
        if (FBTrace.DBG_ERROR)
            FBTrace.sysout("DebuggerLib.getInactiveDebuggerForContext; Debugger not found", exc);
    }

    // If the Debugger Class was not found, make this function no-op.
    if (!DebuggerClass)
        getInactiveDebuggerForContext = function() {};

    var dbg = new DebuggerClass();
    dbg.enabled = false;
    context.inactiveDebugger = dbg;
    return dbg;
};

// ********************************************************************************************* //
// Registration

return DebuggerLib;

// ********************************************************************************************* //
});
