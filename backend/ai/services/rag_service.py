"""
RAG (Retrieval Augmented Generation) Service

Uses LangChain + ChromaDB/FAISS for context-aware Q&A
Indexes course content and provides intelligent responses
"""

import os
from typing import List, Dict, Optional
from pathlib import Path

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.embeddings import HuggingFaceEmbeddings
from langchain.vectorstores import Chroma, FAISS
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from langchain_community.llms import LlamaCpp
from langchain.schema import Document

from django.conf import settings
from student_profile.models import Course, CourseModule, Lesson, CourseAnnouncement
from ai.language_detector import LanguageDetector


class RAGService:
    """
    Retrieval Augmented Generation Service

    Features:
    - Index course content (lessons, modules, announcements)
    - Semantic search using embeddings
    - Context-aware answers using LLM
    - Multi-language support (en/uz/ru)
    """

    def __init__(self):
        self.embeddings = None
        self.vector_store = None
        self.llm = None
        self.qa_chain = None
        self.vector_store_path = Path(settings.BASE_DIR) / 'ai' / 'embeddings' / 'chroma_db'
        self.language_detector = LanguageDetector()

        # Initialize on first use
        self._initialized = False

    def initialize(self):
        """Initialize embeddings and vector store (lazy loading)"""
        if self._initialized:
            return

        print("🚀 Initializing RAG Service...")

        # 1. Initialize embeddings (multilingual model)
        self.embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )

        # 2. Load or create vector store
        self.vector_store_path.parent.mkdir(parents=True, exist_ok=True)

        if self.vector_store_path.exists():
            print("📂 Loading existing vector store...")
            self.vector_store = Chroma(
                persist_directory=str(self.vector_store_path),
                embedding_function=self.embeddings
            )
        else:
            print("🆕 Creating new vector store...")
            self.vector_store = Chroma(
                persist_directory=str(self.vector_store_path),
                embedding_function=self.embeddings
            )

        # 3. Initialize LLM (local LLaMA model)
        model_path = Path(settings.BASE_DIR) / 'ai' / 'models' / 'llama-2-7b-chat.gguf'

        if model_path.exists():
            self.llm = LlamaCpp(
                model_path=str(model_path),
                temperature=0.7,
                max_tokens=512,
                n_ctx=2048,
                n_threads=4,
                verbose=False
            )
        else:
            print("⚠️ Local LLM not found. Will use embeddings-only mode.")
            self.llm = None

        # 4. Create QA chain
        if self.llm:
            self.qa_chain = self._create_qa_chain()

        self._initialized = True
        print("✅ RAG Service initialized!")

    def _create_qa_chain(self) -> RetrievalQA:
        """Create the question-answering chain"""

        # Custom prompt template
        prompt_template = """You are a helpful educational assistant for an online learning platform.
Use the following context to answer the student's question. If you don't know the answer based on the context, say so.

Context:
{context}

Question: {question}

Answer in a clear, helpful, and educational manner:"""

        PROMPT = PromptTemplate(
            template=prompt_template,
            input_variables=["context", "question"]
        )

        return RetrievalQA.from_chain_type(
            llm=self.llm,
            chain_type="stuff",
            retriever=self.vector_store.as_retriever(search_kwargs={"k": 5}),
            chain_type_kwargs={"prompt": PROMPT},
            return_source_documents=True
        )

    def index_course_content(self, course_id: Optional[int] = None):
        """
        Index course content into vector store

        Args:
            course_id: Specific course to index, or None for all courses
        """
        self.initialize()

        print(f"📚 Indexing course content...")

        # Get courses to index
        if course_id:
            courses = Course.objects.filter(id=course_id, is_published=True)
        else:
            courses = Course.objects.filter(is_published=True)

        documents = []

        for course in courses:
            print(f"  📖 Indexing course: {course.name}")

            # Index course description
            if course.description:
                documents.append(Document(
                    page_content=f"Course: {course.name}\n{course.description}",
                    metadata={
                        'type': 'course',
                        'course_id': course.id,
                        'course_name': course.name
                    }
                ))

            # Index modules
            for module in course.modules.filter(is_published=True):
                if module.description:
                    documents.append(Document(
                        page_content=f"Module: {module.title}\n{module.description}",
                        metadata={
                            'type': 'module',
                            'course_id': course.id,
                            'module_id': module.id,
                            'module_title': module.title
                        }
                    ))

                # Index lessons
                for lesson in module.lessons.filter(is_published=True):
                    content = f"Lesson: {lesson.title}\n"

                    if lesson.description:
                        content += f"{lesson.description}\n"

                    if lesson.content:
                        content += f"{lesson.content}\n"

                    documents.append(Document(
                        page_content=content,
                        metadata={
                            'type': 'lesson',
                            'course_id': course.id,
                            'module_id': module.id,
                            'lesson_id': lesson.id,
                            'lesson_title': lesson.title
                        }
                    ))

            # Index announcements
            for announcement in CourseAnnouncement.objects.filter(course=course):
                documents.append(Document(
                    page_content=f"Announcement: {announcement.title}\n{announcement.content}",
                    metadata={
                        'type': 'announcement',
                        'course_id': course.id,
                        'announcement_id': announcement.id
                    }
                ))

        if not documents:
            print("  ⚠️ No documents to index")
            return 0

        # Split documents into chunks
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len
        )
        splits = text_splitter.split_documents(documents)

        print(f"  📄 Created {len(splits)} document chunks")

        # Add to vector store
        self.vector_store.add_documents(splits)
        self.vector_store.persist()

        print(f"✅ Indexed {len(documents)} documents ({len(splits)} chunks)")
        return len(documents)

    def ask_question(self, question: str, course_id: Optional[int] = None, language: Optional[str] = None) -> Dict:
        """
        Answer a question using RAG

        Args:
            question: User's question
            course_id: Optional course filter
            language: Optional language (en/uz/ru), auto-detected if not provided

        Returns:
            Dict with answer, sources, and metadata
        """
        self.initialize()

        # Detect language if not provided
        if not language:
            language = self.language_detector.detect(question)

        # Semantic search for relevant context
        search_kwargs = {"k": 5}

        if course_id:
            search_kwargs["filter"] = {"course_id": course_id}

        relevant_docs = self.vector_store.similarity_search(
            question,
            **search_kwargs
        )

        # If we have LLM, use it for generation
        if self.qa_chain:
            result = self.qa_chain({"query": question})
            answer = result['result']
            sources = result.get('source_documents', [])
        else:
            # Fallback: use most relevant document
            if relevant_docs:
                answer = relevant_docs[0].page_content
                sources = relevant_docs
            else:
                answer = "I don't have enough information to answer that question based on the available course content."
                sources = []

        # Format sources
        formatted_sources = []
        for doc in sources[:3]:  # Top 3 sources
            formatted_sources.append({
                'type': doc.metadata.get('type'),
                'title': doc.metadata.get('lesson_title') or doc.metadata.get('module_title') or doc.metadata.get('course_name'),
                'content_preview': doc.page_content[:200] + '...' if len(doc.page_content) > 200 else doc.page_content,
                'metadata': doc.metadata
            })

        return {
            'answer': answer,
            'sources': formatted_sources,
            'language': language,
            'confidence': len(relevant_docs) > 0
        }

    def get_similar_content(self, text: str, limit: int = 5) -> List[Dict]:
        """
        Find similar content to given text

        Args:
            text: Input text
            limit: Number of results

        Returns:
            List of similar documents with metadata
        """
        self.initialize()

        docs = self.vector_store.similarity_search(text, k=limit)

        results = []
        for doc in docs:
            results.append({
                'content': doc.page_content,
                'type': doc.metadata.get('type'),
                'course_id': doc.metadata.get('course_id'),
                'lesson_id': doc.metadata.get('lesson_id'),
                'title': doc.metadata.get('lesson_title') or doc.metadata.get('module_title'),
                'metadata': doc.metadata
            })

        return results

    def clear_index(self):
        """Clear the entire vector store"""
        if self.vector_store:
            self.vector_store.delete_collection()
            print("🗑️ Vector store cleared")

    def get_stats(self) -> Dict:
        """Get statistics about the indexed content"""
        self.initialize()

        # This is a simplified version - ChromaDB doesn't expose collection size easily
        return {
            'initialized': self._initialized,
            'has_llm': self.llm is not None,
            'vector_store_path': str(self.vector_store_path),
            'vector_store_exists': self.vector_store_path.exists()
        }


# Singleton instance
_rag_service = None

def get_rag_service() -> RAGService:
    """Get or create RAG service singleton"""
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
