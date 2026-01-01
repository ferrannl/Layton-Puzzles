#!/usr/bin/env python3
import json
import re
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Optional

import requests
from bs4 import BeautifulSoup, Tag
