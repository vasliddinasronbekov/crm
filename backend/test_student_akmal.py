#!/usr/bin/env python
"""
Comprehensive API Testing Script for student_akmal
Tests all endpoints and generates frontend configuration
"""

import requests
import json
from datetime import datetime

BASE_URL = "https://api.crmai.uz"  # Your machine's IP
USERNAME = "student_akmal"
PASSWORD = "test"

class APITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.refresh_token = None
        self.results = []

    def log(self, endpoint, method, status, success, response_data=None, error=None):
        """Log test result"""
        result = {
            "endpoint": endpoint,
            "method": method,
            "status": status,
            "success": success,
            "timestamp": datetime.now().isoformat()
        }
        if error:
            result["error"] = str(error)
        if response_data and success:
            result["sample_response"] = response_data
        self.results.append(result)

        status_icon = "✅" if success else "❌"
        print(f"{status_icon} {method} {endpoint} - Status: {status}")
        if error:
            print(f"   Error: {error}")

    def test_login(self):
        """Test login endpoint"""
        print("\n=== TESTING AUTHENTICATION ===")
        endpoint = "/api/auth/login/"

        try:
            response = requests.post(
                f"{self.base_url}{endpoint}",
                json={"username": USERNAME, "password": PASSWORD},
                headers={"Content-Type": "application/json"}
            )

            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access")
                self.refresh_token = data.get("refresh")
                self.log(endpoint, "POST", response.status_code, True, {
                    "has_access_token": bool(self.token),
                    "has_refresh_token": bool(self.refresh_token),
                    "user_info": {k: v for k, v in data.items() if k not in ["access", "refresh"]}
                })
                return True
            else:
                self.log(endpoint, "POST", response.status_code, False, error=response.text)
                return False
        except Exception as e:
            self.log(endpoint, "POST", 0, False, error=str(e))
            return False

    def get_headers(self):
        """Get authorization headers"""
        if self.token:
            return {
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json"
            }
        return {"Content-Type": "application/json"}

    def test_endpoint(self, endpoint, method="GET", data=None, description=""):
        """Test a single endpoint"""
        try:
            url = f"{self.base_url}{endpoint}"
            headers = self.get_headers()

            if method == "GET":
                response = requests.get(url, headers=headers)
            elif method == "POST":
                response = requests.post(url, json=data, headers=headers)
            elif method == "PUT":
                response = requests.put(url, json=data, headers=headers)
            elif method == "PATCH":
                response = requests.patch(url, json=data, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = 200 <= response.status_code < 300

            if success:
                try:
                    resp_data = response.json()
                    # Limit response data for logging
                    if isinstance(resp_data, list):
                        sample = {"count": len(resp_data), "first_item": resp_data[0] if resp_data else None}
                    elif isinstance(resp_data, dict):
                        sample = {k: v for k, v in list(resp_data.items())[:5]}
                    else:
                        sample = resp_data
                    self.log(endpoint, method, response.status_code, True, sample)
                except:
                    self.log(endpoint, method, response.status_code, True)
            else:
                self.log(endpoint, method, response.status_code, False, error=response.text[:200])

            return success, response
        except Exception as e:
            self.log(endpoint, method, 0, False, error=str(e))
            return False, None

    def run_all_tests(self):
        """Run comprehensive API tests"""

        # 1. Login
        if not self.test_login():
            print("\n❌ Login failed! Cannot proceed with other tests.")
            return

        print("\n=== TESTING STUDENT PROFILE ENDPOINTS ===")

        # Student Profile
        self.test_endpoint("/api/v1/student-profile/student/me/", "GET", description="Get my profile")
        self.test_endpoint("/api/v1/student-profile/student/statistics/", "GET", description="Get my statistics")

        print("\n=== TESTING COURSES & GROUPS ===")
        self.test_endpoint("/api/v1/student-profile/courses/", "GET", description="Get my courses")
        self.test_endpoint("/api/v1/student-profile/groups/", "GET", description="Get my groups")

        print("\n=== TESTING LMS ENDPOINTS ===")
        self.test_endpoint("/api/v1/lms/assignments/", "GET", description="Get assignments")
        self.test_endpoint("/api/v1/lms/quizzes/", "GET", description="Get quizzes")
        self.test_endpoint("/api/v1/lms/modules/", "GET", description="Get modules")
        self.test_endpoint("/api/v1/lms/lessons/", "GET", description="Get lessons")
        self.test_endpoint("/api/v1/lms/progress/", "GET", description="Get my progress")

        print("\n=== TESTING ATTENDANCE & EVENTS ===")
        self.test_endpoint("/api/v1/student-profile/attendance/", "GET", description="Get attendance records")
        self.test_endpoint("/api/v1/student-profile/events/", "GET", description="Get events")

        print("\n=== TESTING SHOP & COINS ===")
        self.test_endpoint("/api/v1/student-bonus/", "GET", description="Get my coins")
        self.test_endpoint("/api/v1/student-profile/product/", "GET", description="Get shop products")
        self.test_endpoint("/api/v1/student-profile/order/", "GET", description="Get my orders")

        print("\n=== TESTING EXAMS ===")
        self.test_endpoint("/api/v1/student-profile/ielts/exams/", "GET", description="Get IELTS exams")
        self.test_endpoint("/api/v1/student-profile/ielts/attempts/", "GET", description="Get IELTS attempts")
        self.test_endpoint("/api/v1/student-profile/sat/exams/", "GET", description="Get SAT exams")
        self.test_endpoint("/api/v1/student-profile/sat/attempts/my_attempts/", "GET", description="Get SAT attempts")

        print("\n=== TESTING GAMIFICATION ===")
        self.test_endpoint("/api/gamification/profile/my_profile/", "GET", description="Get gamification profile")
        self.test_endpoint("/api/v1/ranking/leaderboard/", "GET", description="Get leaderboard")

        print("\n=== TESTING PAYMENTS ===")
        self.test_endpoint("/api/v1/student-profile/payment/", "GET", description="Get payments")

        # Generate report
        self.generate_report()

    def generate_report(self):
        """Generate test report and frontend config"""
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)

        total = len(self.results)
        passed = sum(1 for r in self.results if r["success"])
        failed = total - passed

        print(f"\nTotal Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"Success Rate: {(passed/total*100):.1f}%")

        print("\n" + "="*80)
        print("WORKING ENDPOINTS (for frontend configuration)")
        print("="*80)

        working_endpoints = [r for r in self.results if r["success"]]
        for result in working_endpoints:
            print(f"✅ {result['method']:6} {result['endpoint']}")

        if failed > 0:
            print("\n" + "="*80)
            print("FAILED ENDPOINTS (need attention)")
            print("="*80)

            failed_endpoints = [r for r in self.results if not r["success"]]
            for result in failed_endpoints:
                print(f"❌ {result['method']:6} {result['endpoint']}")
                if "error" in result:
                    print(f"   Error: {result['error'][:100]}")

        # Save full report
        with open("api_test_report.json", "w") as f:
            json.dump(self.results, f, indent=2)
        print(f"\n📄 Full report saved to: api_test_report.json")

        # Generate frontend config
        self.generate_frontend_config(working_endpoints)

    def generate_frontend_config(self, working_endpoints):
        """Generate frontend API configuration"""

        config = {
            "API_BASE_URL": BASE_URL,
            "ENDPOINTS": {}
        }

        # Group endpoints by category
        for result in working_endpoints:
            endpoint = result["endpoint"]
            # Extract endpoint name
            parts = endpoint.split("/")
            parts = [p for p in parts if p]  # Remove empty strings

            if len(parts) >= 2:
                category = parts[1] if parts[1] != "v1" else parts[2]
                key = "_".join(parts[2:]) if parts[1] == "v1" else "_".join(parts[1:])
                key = key.upper().replace("-", "_")

                if category not in config["ENDPOINTS"]:
                    config["ENDPOINTS"][category] = {}

                config["ENDPOINTS"][category][key] = endpoint

        with open("frontend_api_config.json", "w") as f:
            json.dump(config, f, indent=2)

        print(f"📱 Frontend config saved to: frontend_api_config.json")


if __name__ == "__main__":
    print("="*80)
    print("STUDENT APP API COMPREHENSIVE TEST")
    print(f"Testing with: {USERNAME}")
    print(f"Base URL: {BASE_URL}")
    print("="*80)

    tester = APITester()
    tester.run_all_tests()
