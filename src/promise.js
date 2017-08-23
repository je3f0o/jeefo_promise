/* -.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.
* File Name   : promise.js
* Created at  : 2016-09-01
* Updated at  : 2017-08-10
* Author      : jeefo
* Purpose     :
* Description :
_._._._._._._._._._._._._._._._._._._._._.*/
//ignore:start

/* globals pendings, pendings_length */
/* exported */

var PENDING_STATE       = PP.define("PENDING_STATE"      , "pending...");
var RESOLVED_STATE      = PP.define("RESOLVED_STATE"     , "resolved");
var REJECTED_STATE      = PP.define("REJECTED_STATE"     , "rejected");
var PENDING_STATE_ENUM  = PP.define("PENDING_STATE_ENUM" , 0);
var RESOLVED_STATE_ENUM = PP.define("RESOLVED_STATE_ENUM", 1);
var REJECTED_STATE_ENUM = PP.define("REJECTED_STATE_ENUM", 2);

var _PENDING_RESOLVER      = PP.define("_PENDING_RESOLVER"     , pendings[pendings_length]);
var _PENDING_REJECTOR      = PP.define("_PENDING_REJECTOR"     , pendings[pendings_length + 1]);
var _NEXT_PENDING_RESOLVER = PP.define("_NEXT_PENDING_RESOLVER", pendings[pendings_length + 2]);
var _NEXT_PENDING_REJECTOR = PP.define("_NEXT_PENDING_REJECTOR", pendings[pendings_length + 3]);

var NEXT_PENDING_RESOLVER = PP.define("NEXT_PENDING_RESOLVER", function (index) { return pendings[index + 2]; }, true);
var NEXT_PENDING_REJECTOR = PP.define("NEXT_PENDING_REJECTOR", function (index) { return pendings[index + 3]; }, true);

var $NEXT_PENDING_RESOLVER = PP.define("$NEXT_PENDING_RESOLVER" , function (index) { return pendings[index + 1]; }, true);
var $NEXT_PENDING_REJECTOR = PP.define("$NEXT_PENDING_REJECTOR" , function (index) { return pendings[index + 2]; }, true);
var $NEXT_PENDING_REJECTOR_CALL = PP.define("$NEXT_PENDING_REJECTOR_CALL", function (index, reason) {
	return pendings[index + 2](reason);
}, true);

var PENDING_RESOLVER_CALL = PP.define("PENDING_RESOLVER_CALL", function (index, value)  { return pendings[index](value);  }, true);
var PENDING_REJECTOR_CALL = PP.define("PENDING_REJECTOR_CALL", function (index, reason) { return pendings[index](reason); }, true);

var NEXT_PENDING_RESOLVER_CALL = PP.define("NEXT_PENDING_RESOLVER_CALL", function (index, value) {
	return pendings[index + 2](value);
}, true);
var NEXT_PENDING_REJECTOR_CALL = PP.define("NEXT_PENDING_REJECTOR_CALL", function (index, reason) {
	return pendings[index + 3](reason);
}, true);

// ignore:end

var JeefoPromise = function (promise_handler, callback, args) {
	var state           = PENDING_STATE_ENUM,
		pendings        = [],
		instance        = this,
		is_last_chain   = true,
		pendings_length = 0,
		result;

	instance.then        = then;
	instance.state       = PENDING_STATE;
	instance.result      = get_result;
	instance.$catch      = $catch;
	instance.$finally    = $finally;
	instance.is_pending  = is_pending;
	instance.is_rejected = is_rejected;
	instance.is_resolved = is_resolved;

	// Promise handler {{{1
	try {
		promise_handler(_resolver, _rejector);
	} catch (e) {
		_rejector(e);
	}
	// }}}1

	// jshint latedef : false
	return instance;

	// Is pending ? {{{1
	function is_pending () {
		return state === PENDING_STATE_ENUM;
	}

	// Is rejected ? {{{1
	function is_rejected () {
		return state === REJECTED_STATE_ENUM;
	}

	// Is resolved ? {{{1
	function is_resolved () {
		return state === RESOLVED_STATE_ENUM;
	}

	// Get result {{{1
	function get_result () {
		return result;
	}

	// Resolver {{{1
	function _resolver (value) {
		if (state !== PENDING_STATE_ENUM) { return; }

		state          = RESOLVED_STATE_ENUM;
		instance.state = RESOLVED_STATE;
		instance.value = result = value;

		for (var i = 0; i < pendings_length; i += 4) {
			try {
				value = PENDING_RESOLVER_CALL(i, result);

				if (value && value.then) {
					value.then(NEXT_PENDING_RESOLVER(i), NEXT_PENDING_REJECTOR(i));
				} else {
					NEXT_PENDING_RESOLVER_CALL(i, value);
				}
			} catch (error) {
				NEXT_PENDING_REJECTOR_CALL(i, error);
			}
		}

		if (is_last_chain && callback) {
			callback.apply(null, args);
		}

		pendings        = null;
		pendings_length = 0;
	}

	// Rejector {{{1
	function _rejector (reason) {
		if (state !== PENDING_STATE_ENUM) { return; }

		state           = REJECTED_STATE_ENUM;
		instance.state  = REJECTED_STATE;
		instance.reason = result = reason;

		for (var i = 1; i < pendings_length; i += 4) {
			try {
				reason = PENDING_REJECTOR_CALL(i, reason);

				if (reason && reason.then) {
					reason.then($NEXT_PENDING_RESOLVER(i), $NEXT_PENDING_REJECTOR(i));
				} else {
					$NEXT_PENDING_REJECTOR_CALL(i, reason);
				}
			} catch (error) {
				$NEXT_PENDING_REJECTOR_CALL(i, error);
			}
		}

		if (is_last_chain && callback) {
			callback.apply(null, args);
		}

		pendings        = null;
		pendings_length = 0;
	}

	// Then {{{1
	function then (resolver, rejector) {
		is_last_chain = false;

		return new JeefoPromise(function (next_resolver, next_rejector) {
			switch (state) {
				case RESOLVED_STATE_ENUM :
					var next_result = resolver ? resolver(result) : result;
					return (next_result && next_result.then)
						? next_result.then(next_resolver, next_rejector)
						: next_resolver(next_result);
				case REJECTED_STATE_ENUM :
					return rejector
						? next_resolver(rejector(result))
						: next_rejector(result);
				default:
					_PENDING_RESOLVER      = resolver || get_result;
					_PENDING_REJECTOR      = rejector;
					_NEXT_PENDING_RESOLVER = next_resolver;
					_NEXT_PENDING_REJECTOR = next_rejector;
					pendings_length += 4;
			}
		});
	}

	// Catch {{{1
	function $catch (rejector) {
		return then(null, rejector);
	}

	// Finally {{{1
	function $finally (callback) {
		return then(function (value) {
			callback(value);
			return value;
		}, function (reason) {
			callback(reason);
			throw reason;
		});
	}
	// }}}1
	// jshint latedef : true
};

module.exports = JeefoPromise;
