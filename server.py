#!/usr/bin/env python3
"""
Simple HTTP server with URL rewriting.
Usage:
    python server.py --rewrite /old:/new/path --rewrite /api:api.json
    python server.py -r /docs:./build/docs -r /:index.html
"""

import argparse
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse


class RewritingRequestHandler(SimpleHTTPRequestHandler):
    rewrites = {}

    def translate_path(self, path):
        parsed = urlparse(path)
        clean_path = parsed.path

        # Check rewrite rules in order
        for url_prefix, fs_target in self.rewrites.items():
            # Exact match
            if clean_path == url_prefix:
                return self._secure_path(fs_target)

            # Directory prefix match
            if clean_path.startswith(url_prefix + '/'):
                suffix = clean_path[len(url_prefix):].lstrip('/')
                if os.path.isdir(fs_target):
                    return self._secure_path(os.path.join(fs_target, suffix))
                # If target is a file, only exact matches are allowed
                continue

        # Fall back to default behavior
        return super().translate_path(path)

    def _secure_path(self, path):
        """Resolve path and prevent directory traversal."""
        abs_path = os.path.abspath(path)
        cwd = os.path.abspath(os.getcwd())
        # Optional: restrict to current directory
        # if not abs_path.startswith(cwd):
        #     return os.path.join(cwd, "404_not_found")
        return abs_path


def run_server(port=8000, rewrites=None, bind=""):
    RewritingRequestHandler.rewrites = rewrites or {}

    server = HTTPServer((bind, port), RewritingRequestHandler)
    addr = f"http://{bind or '0.0.0.0'}:{port}"

    print(f"Serving directory: {os.getcwd()}")
    print(f"Listening on {addr}")
    if RewritingRequestHandler.rewrites:
        print("Rewrites:")
        for src, dst in RewritingRequestHandler.rewrites.items():
            print(f"  {src}  ->  {dst}")
    print("Press Ctrl+C to stop.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="HTTP server with URL path rewriting"
    )
    parser.add_argument("-p", "--port", type=int, default=8000,
                        help="Port to listen on (default: 8000)")
    parser.add_argument("-b", "--bind", default="",
                        help="Address to bind to (default: all interfaces)")
    parser.add_argument("-r", "--rewrite", action="append", default=[],
                        help="Rewrite rule as /url:path (can be used multiple times)")

    args = parser.parse_args()

    rewrites = {}
    for rule in args.rewrite:
        if ":" not in rule:
            print(f"Error: invalid rewrite rule '{rule}'. Use format /url:path")
            sys.exit(1)
        url_path, file_path = rule.split(":", 1)
        rewrites[url_path] = os.path.abspath(file_path)

    run_server(port=args.port, rewrites=rewrites, bind=args.bind)