#!/bin/bash

# Test script for Blog and Case Study CRUD operations
BASE_URL="http://localhost:3000"

echo "========================================="
echo "Testing Authentication & CRUD Operations"
echo "========================================="
echo ""

# 1. Login to get JWT token
echo "1. Testing Login..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bhesi.com","password":"ChangeMe123!"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login FAILED"
  echo "$LOGIN_RESPONSE"
  exit 1
else
  echo "✅ Login SUCCESS"
fi

echo ""
echo "========================================="
echo "BLOG CRUD OPERATIONS"
echo "========================================="
echo ""

# 2. Create Blog
echo "2. Testing Create Blog..."
CREATE_BLOG=$(curl -s -X POST "$BASE_URL/api/blogs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Comprehensive Test Blog",
    "slug": "comprehensive-test-blog",
    "content": "This is a comprehensive test of the blog API with full content.",
    "excerpt": "A comprehensive test blog post",
    "tags": ["test", "api", "demo"],
    "readingMinutes": 10,
    "seo": {
      "title": "Test Blog SEO Title",
      "description": "Test blog SEO description",
      "keywords": ["test", "blog"]
    },
    "published": true
  }')

BLOG_ID=$(echo $CREATE_BLOG | grep -o '"id":"[^"]*' | cut -d'"' -f4)
BLOG_SLUG=$(echo $CREATE_BLOG | grep -o '"slug":"[^"]*' | cut -d'"' -f4)

if [ -z "$BLOG_ID" ]; then
  echo "❌ Create Blog FAILED"
  echo "$CREATE_BLOG"
else
  echo "✅ Create Blog SUCCESS - ID: $BLOG_ID"
fi

echo ""

# 3. Get All Blogs
echo "3. Testing Get All Blogs..."
GET_BLOGS=$(curl -s -X GET "$BASE_URL/api/blogs")

if echo "$GET_BLOGS" | grep -q '"success":true'; then
  BLOG_COUNT=$(echo "$GET_BLOGS" | grep -o '"total":[0-9]*' | cut -d':' -f2)
  echo "✅ Get All Blogs SUCCESS - Total: $BLOG_COUNT blogs"
else
  echo "❌ Get All Blogs FAILED"
  echo "$GET_BLOGS"
fi

echo ""

# 4. Get Single Blog
echo "4. Testing Get Single Blog by Slug..."
GET_BLOG=$(curl -s -X GET "$BASE_URL/api/blogs/$BLOG_SLUG")

if echo "$GET_BLOG" | grep -q '"success":true'; then
  echo "✅ Get Single Blog SUCCESS"
else
  echo "❌ Get Single Blog FAILED"
  echo "$GET_BLOG"
fi

echo ""

# 5. Update Blog
echo "5. Testing Update Blog..."
UPDATE_BLOG=$(curl -s -X PUT "$BASE_URL/api/blogs/$BLOG_SLUG" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Updated Test Blog",
    "excerpt": "Updated excerpt for the test blog"
  }')

if echo "$UPDATE_BLOG" | grep -q '"success":true'; then
  echo "✅ Update Blog SUCCESS"
else
  echo "❌ Update Blog FAILED"
  echo "$UPDATE_BLOG"
fi

echo ""

# 6. Delete Blog
echo "6. Testing Delete Blog..."
DELETE_BLOG=$(curl -s -X DELETE "$BASE_URL/api/blogs/$BLOG_SLUG" \
  -H "Authorization: Bearer $TOKEN")

if echo "$DELETE_BLOG" | grep -q '"success":true'; then
  echo "✅ Delete Blog SUCCESS"
else
  echo "❌ Delete Blog FAILED"
  echo "$DELETE_BLOG"
fi

echo ""
echo "========================================="
echo "CASE STUDY CRUD OPERATIONS"
echo "========================================="
echo ""

# 7. Create Case Study
echo "7. Testing Create Case Study..."
CREATE_CASE_STUDY=$(curl -s -X POST "$BASE_URL/api/case-studies" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Test Case Study",
    "slug": "test-case-study",
    "clientName": "Acme Corporation",
    "industry": "Technology",
    "challenge": "The client needed to scale their infrastructure.",
    "solution": "We implemented a cloud-based solution that increased efficiency by 200%.",
    "results": [
      {"metric": "Performance Improvement", "value": "200%"},
      {"metric": "Cost Reduction", "value": "50%"}
    ],
    "techStack": ["React", "Node.js", "AWS", "PostgreSQL"],
    "heroImage": {"url": "https://example.com/image.jpg", "alt": "Case study image"},
    "published": true
  }')

CASE_STUDY_ID=$(echo $CREATE_CASE_STUDY | grep -o '"id":"[^"]*' | cut -d'"' -f4)
CASE_STUDY_SLUG=$(echo $CREATE_CASE_STUDY | grep -o '"slug":"[^"]*' | cut -d'"' -f4)

if [ -z "$CASE_STUDY_ID" ]; then
  echo "❌ Create Case Study FAILED"
  echo "$CREATE_CASE_STUDY"
else
  echo "✅ Create Case Study SUCCESS - ID: $CASE_STUDY_ID"
fi

echo ""

# 8. Get All Case Studies
echo "8. Testing Get All Case Studies..."
GET_CASE_STUDIES=$(curl -s -X GET "$BASE_URL/api/case-studies")

if echo "$GET_CASE_STUDIES" | grep -q '"success":true'; then
  CASE_STUDY_COUNT=$(echo "$GET_CASE_STUDIES" | grep -o '"total":[0-9]*' | cut -d':' -f2)
  echo "✅ Get All Case Studies SUCCESS - Total: $CASE_STUDY_COUNT case studies"
else
  echo "❌ Get All Case Studies FAILED"
  echo "$GET_CASE_STUDIES"
fi

echo ""

# 9. Get Single Case Study
echo "9. Testing Get Single Case Study by Slug..."
GET_CASE_STUDY=$(curl -s -X GET "$BASE_URL/api/case-studies/$CASE_STUDY_SLUG")

if echo "$GET_CASE_STUDY" | grep -q '"success":true'; then
  echo "✅ Get Single Case Study SUCCESS"
else
  echo "❌ Get Single Case Study FAILED"
  echo "$GET_CASE_STUDY"
fi

echo ""

# 10. Update Case Study
echo "10. Testing Update Case Study..."
UPDATE_CASE_STUDY=$(curl -s -X PUT "$BASE_URL/api/case-studies/$CASE_STUDY_SLUG" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Updated Test Case Study",
    "clientName": "Acme Corp (Updated)"
  }')

if echo "$UPDATE_CASE_STUDY" | grep -q '"success":true'; then
  echo "✅ Update Case Study SUCCESS"
else
  echo "❌ Update Case Study FAILED"
  echo "$UPDATE_CASE_STUDY"
fi

echo ""

# 11. Delete Case Study
echo "11. Testing Delete Case Study..."
DELETE_CASE_STUDY=$(curl -s -X DELETE "$BASE_URL/api/case-studies/$CASE_STUDY_SLUG" \
  -H "Authorization: Bearer $TOKEN")

if echo "$DELETE_CASE_STUDY" | grep -q '"success":true'; then
  echo "✅ Delete Case Study SUCCESS"
else
  echo "❌ Delete Case Study FAILED"
  echo "$DELETE_CASE_STUDY"
fi

echo ""
echo "========================================="
echo "ALL TESTS COMPLETED"
echo "========================================="
