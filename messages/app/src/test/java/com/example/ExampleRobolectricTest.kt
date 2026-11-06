package com.example

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.example.data.repository.SmsRepository
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class ExampleRobolectricTest {

    @Test
    fun `read string from context`() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val appName = context.getString(R.string.app_name)
        assertEquals("Messages", appName)
    }

    @Test
    fun `test repository handles device inbox sync`() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val repository = SmsRepository(context)

        // Sync device inbox without mock data
        val count = repository.syncDeviceSmsInbox()
        assertTrue(count >= 0)
    }

    @Test
    fun `test send sms and message persistence`() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val repository = SmsRepository(context)

        val newThreadId = repository.createNewThread("+254712345678", "Hello from real SMS app")
        assertNotNull(newThreadId)

        val messages = repository.getMessagesForThread(newThreadId).first()
        assertTrue(messages.any { it.content == "Hello from real SMS app" })
    }
}
